#!/usr/bin/env python3
"""
农场闹钟定时检查脚本
通过 GitHub Actions 每5分钟运行一次
检查 Gist 中到期的闹钟，通过 Server酱 推送通知
"""

import json
import os
import sys
from datetime import datetime, timezone, timedelta

try:
    import urllib.request
    import urllib.error
except ImportError:
    print("需要 Python 3 with urllib")
    sys.exit(1)

CST = timezone(timedelta(hours=8))
GH_TOKEN = os.environ.get("GH_TOKEN", "")
SEND_KEY = os.environ.get("SEND_KEY", "")
GIST_DESCRIPTION = "QQFarmTimer"
ALARMS_FILENAME = "alarms.json"


def github_api(path, method="GET", data=None):
    """调用 GitHub API"""
    url = f"https://api.github.com{path}"
    headers = {
        "Authorization": f"token {GH_TOKEN}",
        "Accept": "application/vnd.github.v3+json",
        "User-Agent": "QQFarmTimer-Bot",
    }
    body = None
    if data is not None:
        body = json.dumps(data).encode("utf-8")
        headers["Content-Type"] = "application/json"

    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        print(f"GitHub API 错误: {e.code} {e.reason}")
        if e.fp:
            print(e.fp.read().decode("utf-8")[:500])
        return None


def send_serverchan(title, desp):
    """通过 Server酱 发送微信通知"""
    if not SEND_KEY:
        print("未配置 SEND_KEY，跳过推送")
        return False
    url = f"https://sctapi.ftqq.com/{SEND_KEY}.send"
    params = urllib.parse.urlencode({"title": title, "desp": desp}).encode("utf-8")
    req = urllib.request.Request(url, data=params, method="POST")
    try:
        with urllib.request.urlopen(req) as resp:
            result = json.loads(resp.read().decode("utf-8"))
            if result.get("code") == 0:
                return True
            else:
                print(f"Server酱 返回错误: {result}")
                return False
    except Exception as e:
        print(f"Server酱 请求失败: {e}")
        return False


def main():
    now = datetime.now(CST)
    print(f"=== 农场闹钟检查 ===")
    print(f"当前时间: {now.strftime('%Y-%m-%d %H:%M:%S')}")

    if not GH_TOKEN:
        print("❌ 未配置 GH_TOKEN")
        sys.exit(1)

    # 1. 查找 Gist
    gists = github_api("/gists")
    if gists is None:
        print("❌ 获取 Gist 列表失败")
        sys.exit(1)

    gist_id = None
    for g in gists:
        if g.get("description") == GIST_DESCRIPTION:
            gist_id = g["id"]
            break

    if not gist_id:
        print("💤 未找到闹钟数据 Gist，跳过")
        return

    print(f"找到 Gist: {gist_id}")

    # 2. 读取闹钟数据
    gist = github_api(f"/gists/{gist_id}")
    if gist is None:
        print("❌ 读取 Gist 失败")
        return

    files = gist.get("files", {})
    if ALARMS_FILENAME not in files:
        print("💤 闹钟文件不存在，跳过")
        return

    try:
        alarms = json.loads(files[ALARMS_FILENAME]["content"])
    except json.JSONDecodeError:
        print("❌ 闹钟数据格式错误")
        return

    if not isinstance(alarms, list) or len(alarms) == 0:
        print("💤 闹钟列表为空，跳过")
        return

    print(f"共有 {len(alarms)} 个闹钟")

    # 3. 检查到期闹钟
    notified_ids = []
    expired_ids = []

    for alarm in alarms:
        if not alarm.get("endTime"):
            continue

        try:
            end_time = datetime.fromisoformat(alarm["endTime"].replace("Z", "+00:00")).astimezone(CST)
        except (ValueError, TypeError):
            continue

        # 到期但未推送
        if end_time <= now and not alarm.get("pushNotified"):
            label = alarm.get("label", "定时器")
            message = f"**{label}** 成熟了！快去收菜！\n\n到期时间: {end_time.strftime('%H:%M')}"
            if alarm.get("plant"):
                message += f"\n作物: {alarm['plant']}"

            print(f"🔔 闹钟到期: {label}")
            if send_serverchan("🌾 农场收菜提醒", message):
                notified_ids.append(alarm["id"])

        # 超过24小时过期，清理
        if end_time < now - timedelta(hours=24):
            expired_ids.append(alarm["id"])

    # 4. 更新 Gist 数据
    updated = []
    for alarm in alarms:
        aid = alarm.get("id")
        if aid in expired_ids:
            continue
        if aid in notified_ids:
            alarm["pushNotified"] = True
        updated.append(alarm)

    if notified_ids or expired_ids:
        update_data = {
            "files": {
                ALARMS_FILENAME: {"content": json.dumps(updated, ensure_ascii=False, indent=2)}
            }
        }
        result = github_api(f"/gists/{gist_id}", method="PATCH", data=update_data)
        if result:
            print(f"✅ 已更新 Gist（推送 {len(notified_ids)} 个，清理 {len(expired_ids)} 个）")
        else:
            print("❌ 更新 Gist 失败")
    else:
        print("💤 没有需要处理的闹钟")


if __name__ == "__main__":
    import urllib.parse
    main()

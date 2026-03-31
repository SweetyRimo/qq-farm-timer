// ============================================
// QQ农场经典 - 植物数据库 & 土地类型
// 数据来源：QQ农场WIKI、17173攻略、百度百科等
// ============================================

// ========== 土地类型定义 ==========
const LAND_TYPES = {
    normal: {
        id: "normal",
        name: "普通土地",
        emoji: "🟫",
        level: 0,
        yieldBonus: 0,      // 增产百分比
        timeBonus: 0,       // 成熟时间缩短百分比
        expBonus: 0         // 经验加成百分比
    },
    red: {
        id: "red",
        name: "红土地",
        emoji: "🔴",
        level: 28,
        yieldBonus: 0.10,   // 增产10%
        timeBonus: 0,       // 不缩短时间
        expBonus: 0
    },
    black: {
        id: "black",
        name: "黑土地",
        emoji: "⬛",
        level: 40,
        yieldBonus: 0.20,   // 增产20%
        timeBonus: 0.20,    // 缩短20%成熟时间
        expBonus: 0
    },
    gold: {
        id: "gold",
        name: "金土地",
        emoji: "🟡",
        level: 58,
        yieldBonus: 0.28,   // 增产28%
        timeBonus: 0.20,    // 缩短20%
        expBonus: 0.28      // 经验+28%
    }
};

// ========== 植物数据库 ==========
// land: "any"=所有土地, "normal"=仅普通, "red"=红土地及以上, "black"=黑土地及以上, "gold"=仅金土地
// firstTime: 首季成熟时间(小时), reTime: 后续季成熟时间(小时), seasons: 总季数
const PLANTS_DATABASE = {
    // ===== 普通作物（1季）=====
    "白萝卜": {
        id: "white_radish", name: "白萝卜", emoji: "🥬",
        level: 0, seedPrice: 80, sellPrice: 140, exp: 10,
        firstTime: 10, reTime: 0, seasons: 1,
        land: "any", category: "蔬菜"
    },
    "胡萝卜": {
        id: "carrot", name: "胡萝卜", emoji: "🥕",
        level: 0, seedPrice: 120, sellPrice: 250, exp: 14,
        firstTime: 10, reTime: 0, seasons: 1,
        land: "any", category: "蔬菜"
    },
    "牧草": {
        id: "grass", name: "牧草", emoji: "🌿",
        level: 0, seedPrice: 50, sellPrice: 90, exp: 10,
        firstTime: 8, reTime: 0, seasons: 1,
        land: "any", category: "作物"
    },
    "白菜": {
        id: "cabbage", name: "白菜", emoji: "🥬",
        level: 1, seedPrice: 95, sellPrice: 170, exp: 12,
        firstTime: 14, reTime: 0, seasons: 1,
        land: "any", category: "蔬菜"
    },
    "大蒜": {
        id: "garlic", name: "大蒜", emoji: "🧄",
        level: 1, seedPrice: 110, sellPrice: 195, exp: 13,
        firstTime: 14, reTime: 0, seasons: 1,
        land: "any", category: "蔬菜"
    },
    "小麦": {
        id: "wheat", name: "小麦", emoji: "🌾",
        level: 1, seedPrice: 105, sellPrice: 185, exp: 13,
        firstTime: 14, reTime: 0, seasons: 1,
        land: "any", category: "粮食"
    },
    "水稻": {
        id: "rice", name: "水稻", emoji: "🌾",
        level: 1, seedPrice: 115, sellPrice: 200, exp: 13,
        firstTime: 14, reTime: 0, seasons: 1,
        land: "any", category: "粮食"
    },
    "玉米": {
        id: "corn", name: "玉米", emoji: "🌽",
        level: 4, seedPrice: 150, sellPrice: 310, exp: 16,
        firstTime: 11, reTime: 0, seasons: 1,
        land: "any", category: "粮食"
    },
    "土豆": {
        id: "potato", name: "土豆", emoji: "🥔",
        level: 7, seedPrice: 180, sellPrice: 380, exp: 18,
        firstTime: 15, reTime: 0, seasons: 1,
        land: "any", category: "蔬菜"
    },
    "葫芦": {
        id: "calabash", name: "葫芦", emoji: "🫙",
        level: 8, seedPrice: 300, sellPrice: 560, exp: 22,
        firstTime: 20, reTime: 0, seasons: 1,
        land: "any", category: "作物"
    },
    "茄子": {
        id: "eggplant", name: "茄子", emoji: "🍆",
        level: 10, seedPrice: 230, sellPrice: 470, exp: 20,
        firstTime: 16, reTime: 0, seasons: 1,
        land: "any", category: "蔬菜"
    },
    "圣诞树": {
        id: "christmas_tree", name: "圣诞树", emoji: "🎄",
        level: 11, seedPrice: 350, sellPrice: 620, exp: 14,
        firstTime: 13, reTime: 0, seasons: 1,
        land: "any", category: "作物"
    },
    "向日葵": {
        id: "sunflower", name: "向日葵", emoji: "🌻",
        level: 12, seedPrice: 270, sellPrice: 500, exp: 14,
        firstTime: 9, reTime: 0, seasons: 1,
        land: "any", category: "花卉"
    },
    "郁金香": {
        id: "tulip", name: "郁金香", emoji: "🌷",
        level: 15, seedPrice: 350, sellPrice: 620, exp: 15,
        firstTime: 52, reTime: 22, seasons: 3,
        land: "any", category: "花卉"
    },
    "番茄": {
        id: "tomato", name: "番茄", emoji: "🍅",
        level: 13, seedPrice: 290, sellPrice: 560, exp: 22,
        firstTime: 17, reTime: 0, seasons: 1,
        land: "any", category: "蔬菜"
    },
    "豌豆": {
        id: "pea", name: "豌豆", emoji: "🫛",
        level: 16, seedPrice: 360, sellPrice: 680, exp: 24,
        firstTime: 18, reTime: 0, seasons: 1,
        land: "any", category: "蔬菜"
    },
    "玫瑰": {
        id: "rose", name: "玫瑰", emoji: "🌹",
        level: 20, seedPrice: 420, sellPrice: 750, exp: 16,
        firstTime: 10, reTime: 0, seasons: 1,
        land: "any", category: "花卉"
    },
    "辣椒": {
        id: "chili", name: "辣椒", emoji: "🌶️",
        level: 19, seedPrice: 440, sellPrice: 830, exp: 26,
        firstTime: 20, reTime: 0, seasons: 1,
        land: "any", category: "蔬菜"
    },
    "小雏菊": {
        id: "daisy", name: "小雏菊", emoji: "🌼",
        level: 20, seedPrice: 440, sellPrice: 790, exp: 18,
        firstTime: 17, reTime: 0, seasons: 1,
        land: "any", category: "花卉"
    },
    "南瓜": {
        id: "pumpkin", name: "南瓜", emoji: "🎃",
        level: 22, seedPrice: 540, sellPrice: 990, exp: 28,
        firstTime: 22, reTime: 0, seasons: 1,
        land: "any", category: "蔬菜"
    },
    "棉花": {
        id: "cotton", name: "棉花", emoji: "☁️",
        level: 22, seedPrice: 500, sellPrice: 920, exp: 26,
        firstTime: 24, reTime: 0, seasons: 1,
        land: "any", category: "作物"
    },
    "花生": {
        id: "peanut", name: "花生", emoji: "🥜",
        level: 19, seedPrice: 420, sellPrice: 780, exp: 24,
        firstTime: 19, reTime: 0, seasons: 1,
        land: "any", category: "坚果"
    },

    // ===== 多季水果 =====
    "草莓": {
        id: "strawberry", name: "草莓", emoji: "🍓",
        level: 5, seedPrice: 380, sellPrice: 720, exp: 20,
        firstTime: 33, reTime: 10, seasons: 2,
        land: "any", category: "水果"
    },
    "西瓜": {
        id: "watermelon", name: "西瓜", emoji: "🍉",
        level: 24, seedPrice: 580, sellPrice: 1050, exp: 30,
        firstTime: 41, reTime: 13, seasons: 2,
        land: "any", category: "水果"
    },
    "香蕉": {
        id: "banana", name: "香蕉", emoji: "🍌",
        level: 25, seedPrice: 660, sellPrice: 1200, exp: 32,
        firstTime: 45, reTime: 14, seasons: 2,
        land: "any", category: "水果"
    },
    "猕猴桃": {
        id: "kiwi", name: "猕猴桃", emoji: "🥝",
        level: 20, seedPrice: 550, sellPrice: 980, exp: 28,
        firstTime: 31, reTime: 14, seasons: 4,
        land: "any", category: "水果"
    },
    "桃子": {
        id: "peach", name: "桃子", emoji: "🍑",
        level: 25, seedPrice: 660, sellPrice: 1200, exp: 30,
        firstTime: 60, reTime: 18, seasons: 2,
        land: "any", category: "水果"
    },
    "橙子": {
        id: "orange", name: "橙子", emoji: "🍊",
        level: 28, seedPrice: 800, sellPrice: 1440, exp: 34,
        firstTime: 69, reTime: 16, seasons: 3,
        land: "any", category: "水果"
    },
    "葡萄": {
        id: "grape", name: "葡萄", emoji: "🍇",
        level: 28, seedPrice: 800, sellPrice: 1440, exp: 34,
        firstTime: 86, reTime: 20, seasons: 3,
        land: "any", category: "水果"
    },
    "石榴": {
        id: "pomegranate", name: "石榴", emoji: "🍎",
        level: 30, seedPrice: 960, sellPrice: 1700, exp: 38,
        firstTime: 96, reTime: 22, seasons: 3,
        land: "any", category: "水果"
    },
    "柠檬": {
        id: "lemon", name: "柠檬", emoji: "🍋",
        level: 26, seedPrice: 620, sellPrice: 1100, exp: 30,
        firstTime: 14, reTime: 0, seasons: 1,
        land: "any", category: "水果"
    },
    "蘑菇": {
        id: "mushroom", name: "蘑菇", emoji: "🍄",
        level: 17, seedPrice: 450, sellPrice: 820, exp: 22,
        firstTime: 30, reTime: 10, seasons: 3,
        land: "any", category: "作物"
    },
    "红枣": {
        id: "red_date", name: "红枣", emoji: "🔴",
        level: 30, seedPrice: 900, sellPrice: 1580, exp: 36,
        firstTime: 12, reTime: 0, seasons: 1,
        land: "any", category: "水果"
    },

    // ===== 多季花卉 =====
    "牡丹": {
        id: "peony", name: "牡丹", emoji: "🌺",
        level: 30, seedPrice: 500, sellPrice: 880, exp: 18,
        firstTime: 20, reTime: 0, seasons: 1,
        land: "any", category: "花卉"
    },
    "粉玫瑰": {
        id: "pink_rose", name: "粉玫瑰", emoji: "🩷",
        level: 32, seedPrice: 920, sellPrice: 1650, exp: 36,
        firstTime: 28, reTime: 13, seasons: 2,
        land: "any", category: "花卉"
    },
    "海洋之心": {
        id: "ocean_heart", name: "海洋之心", emoji: "💎",
        level: 35, seedPrice: 1100, sellPrice: 1960, exp: 42,
        firstTime: 25, reTime: 10, seasons: 2,
        land: "any", category: "花卉"
    },
    "非洲菊": {
        id: "african_daisy", name: "非洲菊", emoji: "🌻",
        level: 33, seedPrice: 960, sellPrice: 1720, exp: 38,
        firstTime: 21, reTime: 9, seasons: 2,
        land: "any", category: "花卉"
    },
    "铃兰": {
        id: "lily_of_valley", name: "铃兰", emoji: "🔔",
        level: 36, seedPrice: 1200, sellPrice: 2140, exp: 44,
        firstTime: 32, reTime: 14, seasons: 4,
        land: "any", category: "花卉"
    },
    "仙人掌": {
        id: "cactus", name: "仙人掌", emoji: "🌵",
        level: 36, seedPrice: 1180, sellPrice: 2100, exp: 44,
        firstTime: 32, reTime: 14, seasons: 4,
        land: "any", category: "花卉"
    },
    "栀子花": {
        id: "gardenia", name: "栀子花", emoji: "🤍",
        level: 38, seedPrice: 1320, sellPrice: 2360, exp: 48,
        firstTime: 37, reTime: 16, seasons: 3,
        land: "any", category: "花卉"
    },
    "摇钱树": {
        id: "money_tree", name: "摇钱树", emoji: "💰",
        level: 38, seedPrice: 1350, sellPrice: 2400, exp: 48,
        firstTime: 37, reTime: 16, seasons: 3,
        land: "any", category: "花卉"
    },
    "天香百合": {
        id: "lily", name: "天香百合", emoji: "💐",
        level: 39, seedPrice: 1400, sellPrice: 2480, exp: 50,
        firstTime: 20, reTime: 0, seasons: 1,
        land: "any", category: "花卉"
    },
    "蓝玫瑰": {
        id: "blue_rose", name: "蓝玫瑰", emoji: "💙",
        level: 42, seedPrice: 1600, sellPrice: 2840, exp: 54,
        firstTime: 42, reTime: 18, seasons: 4,
        land: "any", category: "花卉"
    },
    "水仙花": {
        id: "daffodil", name: "水仙花", emoji: "🌼",
        level: 34, seedPrice: 1040, sellPrice: 1860, exp: 40,
        firstTime: 31, reTime: 14, seasons: 2,
        land: "any", category: "花卉"
    },
    "风信子": {
        id: "hyacinth", name: "风信子", emoji: "💜",
        level: 34, seedPrice: 1040, sellPrice: 1860, exp: 40,
        firstTime: 31, reTime: 14, seasons: 2,
        land: "any", category: "花卉"
    },
    "四叶草": {
        id: "four_leaf_clover", name: "四叶草", emoji: "🍀",
        level: 35, seedPrice: 1100, sellPrice: 1960, exp: 42,
        firstTime: 23, reTime: 10, seasons: 2,
        land: "any", category: "花卉"
    },
    "蒲公英": {
        id: "dandelion", name: "蒲公英", emoji: "🌻",
        level: 35, seedPrice: 1120, sellPrice: 2000, exp: 42,
        firstTime: 24, reTime: 0, seasons: 1,
        land: "any", category: "花卉"
    },
    "爱心果": {
        id: "love_fruit", name: "爱心果", emoji: "❤️",
        level: 37, seedPrice: 1280, sellPrice: 2280, exp: 46,
        firstTime: 31, reTime: 14, seasons: 3,
        land: "any", category: "水果"
    },
    "银杏": {
        id: "ginkgo", name: "银杏", emoji: "🍂",
        level: 37, seedPrice: 1260, sellPrice: 2240, exp: 46,
        firstTime: 35, reTime: 15, seasons: 3,
        land: "any", category: "花卉"
    },
    "蝴蝶兰": {
        id: "butterfly_orchid", name: "蝴蝶兰", emoji: "🦋",
        level: 40, seedPrice: 1450, sellPrice: 2560, exp: 52,
        firstTime: 64, reTime: 26, seasons: 3,
        land: "any", category: "花卉"
    },
    "薰衣草": {
        id: "lavender", name: "薰衣草", emoji: "💜",
        level: 40, seedPrice: 1420, sellPrice: 2520, exp: 52,
        firstTime: 61, reTime: 26, seasons: 3,
        land: "any", category: "花卉"
    },
    "马蹄莲": {
        id: "calla_lily", name: "马蹄莲", emoji: "🤍",
        level: 40, seedPrice: 1400, sellPrice: 2480, exp: 52,
        firstTime: 64, reTime: 26, seasons: 3,
        land: "any", category: "花卉"
    },

    // ===== 多季作物 =====
    "山竹": {
        id: "mangosteen", name: "山竹", emoji: "🟣",
        level: 36, seedPrice: 1220, sellPrice: 2170, exp: 44,
        firstTime: 31, reTime: 14, seasons: 4,
        land: "any", category: "水果"
    },
    "月柿": {
        id: "persimmon", name: "月柿", emoji: "🟠",
        level: 38, seedPrice: 1320, sellPrice: 2350, exp: 48,
        firstTime: 31, reTime: 14, seasons: 5,
        land: "any", category: "水果"
    },
    "桑葚": {
        id: "mulberry", name: "桑葚", emoji: "🫐",
        level: 38, seedPrice: 1340, sellPrice: 2380, exp: 48,
        firstTime: 31, reTime: 14, seasons: 5,
        land: "any", category: "水果"
    },
    "哈密瓜": {
        id: "cantaloupe", name: "哈密瓜", emoji: "🍈",
        level: 40, seedPrice: 1480, sellPrice: 2620, exp: 52,
        firstTime: 31, reTime: 14, seasons: 5,
        land: "any", category: "水果"
    },
    "琉璃果": {
        id: "colored_fruit", name: "琉璃果", emoji: "🔮",
        level: 44, seedPrice: 1700, sellPrice: 3000, exp: 56,
        firstTime: 46, reTime: 18, seasons: 4,
        land: "any", category: "水果"
    },

    // ===== 红土地专属作物 =====
    "瓶子树": {
        id: "bottle_tree", name: "瓶子树", emoji: "🫙",
        level: 28, seedPrice: 800, sellPrice: 1440, exp: 34,
        firstTime: 15, reTime: 0, seasons: 1,
        land: "red", category: "红土作物"
    },
    "猪笼草": {
        id: "pitcher_plant", name: "猪笼草", emoji: "🌿",
        level: 29, seedPrice: 860, sellPrice: 1540, exp: 36,
        firstTime: 16, reTime: 0, seasons: 1,
        land: "red", category: "红土作物"
    },
    "曼珠沙华": {
        id: "red_spider_lily", name: "曼珠沙华", emoji: "🔴",
        level: 30, seedPrice: 920, sellPrice: 1650, exp: 38,
        firstTime: 18, reTime: 0, seasons: 1,
        land: "red", category: "红土作物"
    },
    "金边灵芝": {
        id: "golden_lingzhi", name: "金边灵芝", emoji: "✨",
        level: 41, seedPrice: 1580, sellPrice: 2800, exp: 54,
        firstTime: 20, reTime: 0, seasons: 1,
        land: "red", category: "红土作物"
    },
    "何首乌": {
        id: "fleeceflower", name: "何首乌", emoji: "🌿",
        level: 42, seedPrice: 1640, sellPrice: 2900, exp: 56,
        firstTime: 21, reTime: 0, seasons: 1,
        land: "red", category: "红土作物"
    },
    "人参": {
        id: "ginseng", name: "人参", emoji: "🌿",
        level: 43, seedPrice: 1700, sellPrice: 3000, exp: 58,
        firstTime: 22, reTime: 0, seasons: 1,
        land: "red", category: "红土作物"
    },
    "似血杜鹃": {
        id: "blood_azalea", name: "似血杜鹃", emoji: "🌺",
        level: 44, seedPrice: 1780, sellPrice: 3150, exp: 60,
        firstTime: 24, reTime: 0, seasons: 1,
        land: "red", category: "红土作物"
    },
    "芹叶铁线莲": {
        id: "clematis", name: "芹叶铁线莲", emoji: "🌸",
        level: 45, seedPrice: 1850, sellPrice: 3270, exp: 62,
        firstTime: 25, reTime: 0, seasons: 1,
        land: "red", category: "红土作物"
    },
    "冰凌花": {
        id: "ice_flower", name: "冰凌花", emoji: "❄️",
        level: 53, seedPrice: 2400, sellPrice: 4230, exp: 76,
        firstTime: 30, reTime: 0, seasons: 1,
        land: "red", category: "红土作物"
    },
    "天山雪莲": {
        id: "snow_lotus", name: "天山雪莲", emoji: "🏔️",
        level: 40, seedPrice: 1520, sellPrice: 2690, exp: 52,
        firstTime: 18, reTime: 0, seasons: 1,
        land: "red", category: "红土作物"
    },
    "园艺独角兽": {
        id: "unicorn", name: "园艺独角兽", emoji: "🦄",
        level: 50, seedPrice: 2100, sellPrice: 3700, exp: 68,
        firstTime: 28, reTime: 0, seasons: 1,
        land: "red", category: "红土作物"
    }
};

// ========== 成熟时间计算 ==========

/**
 * 计算植物在指定土地上的首次成熟时间（小时，支持小数）
 * @param {string} plantName - 植物名称
 * @param {string} landType - 土地类型ID (normal/red/black/gold)
 * @returns {number} 成熟时间（小时）
 */
function calcGrowTime(plantName, landType) {
    const plant = PLANTS_DATABASE[plantName];
    const land = LAND_TYPES[landType];
    if (!plant || !land) return 0;

    // 首季成熟时间 × (1 - 土地时间缩短比例)
    return Math.round(plant.firstTime * (1 - land.timeBonus) * 10) / 10;
}

/**
 * 计算植物在指定土地上的总成熟时间（所有季，小时）
 * @param {string} plantName
 * @param {string} landType
 * @returns {number}
 */
function calcTotalGrowTime(plantName, landType) {
    const plant = PLANTS_DATABASE[plantName];
    const land = LAND_TYPES[landType];
    if (!plant || !land) return 0;

    const timeMultiplier = 1 - land.timeBonus;
    let total = plant.firstTime * timeMultiplier;
    if (plant.seasons > 1) {
        total += plant.reTime * timeMultiplier * (plant.seasons - 1);
    }
    return Math.round(total * 10) / 10;
}

/**
 * 检查植物能否种植在指定土地上
 * @param {object} plant
 * @param {string} landType
 * @returns {boolean}
 */
function canPlantOnLand(plant, landType) {
    if (plant.land === "any") return true;
    const order = ["normal", "red", "black", "gold"];
    const plantIdx = order.indexOf(plant.land);
    const landIdx = order.indexOf(landType);
    return landIdx >= plantIdx;
}

/**
 * 获取植物在指定土地上每次成熟的时间列表（小时数组）
 * @param {string} plantName
 * @param {string} landType
 * @returns {number[]}
 */
function getSeasonTimes(plantName, landType) {
    const plant = PLANTS_DATABASE[plantName];
    const land = LAND_TYPES[landType];
    if (!plant || !land) return [];

    const timeMultiplier = 1 - land.timeBonus;
    const times = [];
    times.push(Math.round(plant.firstTime * timeMultiplier * 10) / 10);
    for (let i = 1; i < plant.seasons; i++) {
        times.push(Math.round(plant.reTime * timeMultiplier * 10) / 10);
    }
    return times;
}

// ========== 兼容旧接口（growthTime = 首季普通土地时间）==========
// 旧代码使用 plant.growthTime，这里动态计算以保持兼容
Object.keys(PLANTS_DATABASE).forEach(name => {
    const plant = PLANTS_DATABASE[name];
    if (!plant.growthTime) {
        plant.growthTime = plant.firstTime;
    }
});

// ========== 查询工具函数 ==========

function getPlantsSortedByTime(landType = 'normal') {
    return Object.values(PLANTS_DATABASE)
        .filter(p => canPlantOnLand(p, landType))
        .sort((a, b) => calcGrowTime(a.name, landType) - calcGrowTime(b.name, landType));
}

function findPlantsByTimeRange(minHours, maxHours, landType = 'normal') {
    return Object.values(PLANTS_DATABASE)
        .filter(p => {
            if (!canPlantOnLand(p, landType)) return false;
            const t = calcGrowTime(p.name, landType);
            return t >= minHours && t <= maxHours;
        })
        .sort((a, b) => calcGrowTime(a.name, landType) - calcGrowTime(b.name, landType));
}

function findClosestPlant(targetHours, landType = 'normal') {
    const plants = Object.values(PLANTS_DATABASE).filter(p => canPlantOnLand(p, landType));
    let closest = plants[0];
    let minDiff = Math.abs(calcGrowTime(plants[0].name, landType) - targetHours);
    
    plants.forEach(p => {
        const diff = Math.abs(calcGrowTime(p.name, landType) - targetHours);
        if (diff < minDiff) {
            minDiff = diff;
            closest = p;
        }
    });
    
    return { plant: closest, diff: minDiff };
}

function searchPlants(keyword, landType = 'normal') {
    if (!keyword) return Object.values(PLANTS_DATABASE).filter(p => canPlantOnLand(p, landType));
    const kw = keyword.toLowerCase();
    return Object.values(PLANTS_DATABASE).filter(p =>
        (p.name.toLowerCase().includes(kw) || p.emoji.includes(kw)) && canPlantOnLand(p, landType)
    );
}

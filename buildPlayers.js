const fs = require('fs');
const path = require('path');

// 1. 中文名稱對應英文 ID 字典
const bossNameToIdMap = {
  "史烏": "lotus",
  "戴米安": "damien",
  "露希妲": "lucid",
  "威爾": "will",
  "綠水靈": "guardian_angel_slime",
  "真希拉": "verus_hilla",
  "頓凱爾": "dunkel",
  "戴斯克": "gloom",
  "黑魔法師": "black_mage",
  "賽蓮": "seren",
  "卡洛斯": "kalos",
  "咖凌": "kaling",
  "林波": "limbo"
};

// 2. 輸入資料：現在可以完全使用「中文 BOSS 名稱」！
// 若要使用重置券打第二次，名稱後面一樣加上 "(重置)" 或 "*2" 即可
const rawData = [
  {
    player: "Rumi",
    characters: [
      {
        char: "幸運星",
        bosses: [
          "史烏*2",
          "戴米安",
          "露希妲",
          "威爾",
          "綠水靈",
          "真希拉",
          "頓凱爾",
          "戴斯克",
          "黑魔法師",
          "賽蓮",
          "卡洛斯",
          "咖凌"
        ]
      },
      {
        char: "灣胖曲",
        bosses: [
          "史烏*2",
          "戴米安",
          "綠水靈",
          "露希妲"
        ]
      }
    ]
  },
  {
    player: "巴塔",
    characters: [
      {
        char: "BATA",
        bosses: [
          "卡洛斯",
          "咖凌",
          "林波",
          "史烏*2"
        ]
      }
    ]
  }
];

// 3. 轉換函式：自動將中文名稱轉為英文 ID 並建立 json 結構
function buildPlayersConfig(data) {
  return data.map((pItem, pIdx) => {
    const characters = pItem.characters.map((cItem, cIdx) => {
      const bossIds = [];
      const resetBossIds = [];

      (cItem.bosses || []).forEach(bossInput => {
        const isReset = bossInput.includes("重置") || bossInput.includes("*2");
        // 去除標籤，取得乾淨的中文 BOSS 名稱
        const cleanChineseName = bossInput.replace("(重置)", "").replace("*2", "").trim();
        
        // 從字典查找對應的英文 ID
        const bossId = bossNameToIdMap[cleanChineseName];

        if (bossId) {
          // 收集可攻略的 BOSS 清單 (英文 ID)
          if (!bossIds.includes(bossId)) {
            bossIds.push(bossId);
          }

          // 收集重置券 BOSS 清單 (英文 ID)
          if (isReset && !resetBossIds.includes(bossId)) {
            resetBossIds.push(bossId);
          }
        } else {
          console.warn(`⚠️ 找不到 BOSS [${cleanChineseName}] 的英文 ID 對照，請檢查名稱是否正確！`);
        }
      });

      return {
        id: `char_p${pIdx + 1}_${cIdx + 1}`,
        name: cItem.char,
        bossIds: bossIds,
        resetBossIds: resetBossIds
      };
    });

    return {
      name: pItem.player,
      characters: characters
    };
  });
}

// 4. 執行轉換並輸出 players.json
function main() {
  const result = buildPlayersConfig(rawData);
  const outputPath = path.join(__dirname, 'players.json');
  
  fs.writeFileSync(outputPath, JSON.stringify(result, null, 2), 'utf8');
  console.log(`✅ 成功產出 players.json 至: ${outputPath}`);
}

main();
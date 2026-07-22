// buildPlayersConfig.js
const fs = require('fs');
const path = require('path');

const bossNameToIdMap = require('./bossMap');
const characterSettingsPath = path.join(__dirname, 'characterSettings.json');

function buildPlayersConfig(data) {
  return data.map((pItem, pIdx) => {
    const characters = pItem.characters.map((cItem, cIdx) => {
      const bossIds = [];
      const resetBossIds = [];

      (cItem.bosses || []).forEach(bossInput => {
        const isReset = bossInput.includes("重置") || bossInput.includes("*2");
        const cleanChineseName = bossInput.replace("(重置)", "").replace("*2", "").trim();
        const bossId = bossNameToIdMap[cleanChineseName];

        if (bossId) {
          if (!bossIds.includes(bossId)) {
            bossIds.push(bossId);
          }
          if (isReset && !resetBossIds.includes(bossId)) {
            resetBossIds.push(bossId);
          }
        } else {
          console.warn(`⚠️ 找不到 BOSS [${cleanChineseName}] 的對照，請檢查名稱是否正確！`);
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

function main() {
  try {
    if (!fs.existsSync(characterSettingsPath)) {
      console.error(`❌ 找不到原始資料檔: ${characterSettingsPath}`);
      return;
    }

    const rawData = JSON.parse(fs.readFileSync(characterSettingsPath, 'utf8'));
    const result = buildPlayersConfig(rawData);
    
    // 1. 改為輸出 players.js
    const outputPath = path.join(__dirname, 'players.js');
    
    // 2. 加上變數宣告：const playersData = [ ... ];
    const jsContent = `const playersData = ${JSON.stringify(result, null, 2)};\n`;
    
    fs.writeFileSync(outputPath, jsContent, 'utf8');
    console.log(`✅ 成功轉換！已產出 players.js 至: ${outputPath}`);
  } catch (error) {
    console.error("❌ 轉換過程發生錯誤：", error.message);
  }
}

main();
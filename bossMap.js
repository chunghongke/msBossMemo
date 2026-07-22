// bossMap.js
const bossNameToIdMap = {
  // --- 史烏 ---
  "普史": "lotus_normal",
  "普史烏": "lotus_normal",
  "史烏": "lotus_normal",
  "困史": "lotus_hard",
  "困史烏": "lotus_hard",
  "(困)史烏": "lotus_hard",
  "極史": "lotus_extreme",
  "極史烏": "lotus_extreme",
  "(極)史烏": "lotus_extreme",

  // --- 戴米安 ---
  "普戴": "damien_normal",
  "普戴米安": "damien_normal",
  "戴米安": "damien_normal",
  "困戴": "damien_hard",
  "困戴米安": "damien_hard",
  "(困)戴米安": "damien_hard",

  // --- 露希妲 ---
  "普露": "lucid_normal",
  "普露希妲": "lucid_normal",
  "露希妲": "lucid_normal",
  "困露": "lucid_hard",
  "困露希妲": "lucid_hard",
  "(困)露希妲": "lucid_hard",

  // --- 威爾 ---
  "普威": "will_normal",
  "普威爾": "will_normal",
  "威爾": "will_normal",
  "困威": "will_hard",
  "困威爾": "will_hard",
  "(困)威爾": "will_hard",

  // --- 綠水靈 ---
  "普綠": "guardian_angel_slime_normal",
  "普綠水靈": "guardian_angel_slime_normal",
  "綠水靈": "guardian_angel_slime_normal",
  "困綠": "guardian_angel_slime_hard",
  "困綠水靈": "guardian_angel_slime_hard",
  "(困)綠水靈": "guardian_angel_slime_hard",

  // --- 真希拉 ---
  "普真": "verus_hilla_normal",
  "普真希拉": "verus_hilla_normal",
  "真希拉": "verus_hilla_normal",
  "困真希": "verus_hilla_hard",
  "困真希拉": "verus_hilla_hard",
  "(困)真希拉": "verus_hilla_hard",

  // --- 頓凱爾 ---
  "普頓": "dunkel",
  "普頓凱爾": "dunkel",
  "頓凱爾": "dunkel",
  "困頓": "dunkel_hard",
  "困頓凱爾": "dunkel_hard",
  "(困)頓凱爾": "dunkel_hard",

  // --- 戴斯克 ---
  "普戴斯克": "gloom_normal",
  "戴斯克": "gloom_normal",
  "困戴斯克": "gloom_hard",
  "(困)戴斯克": "gloom_hard",

  // --- 賽蓮 ---
  "普賽": "seren_normal",
  "普賽蓮": "seren_normal",
  "賽蓮": "seren_normal",
  "困賽": "seren_hard",
  "困賽蓮": "seren_hard",
  "(困)賽蓮": "seren_hard",
  "極賽": "seren_extreme",
  "極賽蓮": "seren_extreme",
  "(極)賽蓮": "seren_extreme",

  // --- 卡洛斯 ---
  "簡卡": "kalos_easy",
  "簡卡洛斯": "kalos_easy",
  "普狗": "kalos_normal",
  "普卡洛斯": "kalos_normal",
  "卡洛斯": "kalos_easy",
  "困狗": "kalos_hard",
  "困卡洛斯": "kalos_hard",
  "(困)卡洛斯": "kalos_hard",
  "極卡": "kalos_extreme",
  "極卡洛斯": "kalos_extreme",
  "(極)卡洛斯": "kalos_extreme",

  // --- 咖凌 ---
  "簡咖": "kaling_easy",
  "簡咖凌": "kaling_easy",
  "普咖": "kaling_normal",
  "普咖凌": "kaling_normal",
  "咖凌": "kaling_easy",
  "困咖": "kaling_hard",
  "困咖凌": "kaling_hard",
  "(困)咖凌": "kaling_hard",
  "極咖": "kaling_extreme",
  "極咖凌": "kaling_extreme",
  "(極)咖凌": "kaling_extreme",

  // --- 最初的敵對者 ---
  "簡敵": "first_adversary_easy",
  "簡敵對者": "first_adversary_easy",
  "最初的敵對者": "first_adversary_easy",
  "普敵": "first_adversary_normal",
  "普敵對者": "first_adversary_normal",
  "(普)最初的敵對者": "first_adversary_normal",
  "困敵": "first_adversary_hard",
  "困敵對者": "first_adversary_hard",
  "(困)最初的敵對者": "first_adversary_hard",
  "極敵": "first_adversary_extreme",
  "極敵對者": "first_adversary_extreme",
  "(極)最初的敵對者": "first_adversary_extreme",

  // --- 燦爛的凶星 ---
  "普凶": "radiant_star_normal",
  "普凶星": "radiant_star_normal",
  "燦爛的凶星": "radiant_star_normal",
  "困凶": "radiant_star_hard",
  "困凶星": "radiant_star_hard",
  "(困)燦爛的凶星": "radiant_star_hard",

  // --- 林波 ---
  "普林": "limbo_normal",
  "普林波": "limbo_normal",
  "普波": "limbo_normal",
  "林波": "limbo_normal",
  "困林": "limbo_hard",
  "困林波": "limbo_hard",
  "困波": "limbo_hard",
  "(困)林波": "limbo_hard",

  // --- 巴德利斯 ---
  "普人馬": "baldrix_normal",
  "普巴德利斯": "baldrix_normal",
  "巴德利斯": "baldrix_normal",
  "困人馬": "baldrix_hard",
  "困巴德利斯": "baldrix_hard",
  "(困)巴德利斯": "baldrix_hard",

  // --- 尤比太 ---
  "普尤": "youpiter_normal",
  "普尤比太": "youpiter_normal",
  "尤比太": "youpiter_normal",
  "困尤": "youpiter_hard",
  "困尤比太": "youpiter_hard",
  "(困)尤比太": "youpiter_hard",

  // --- 黑魔法師 ---
  "黑黑": "black_mage_hard",
  "黑魔法師": "black_mage_hard",
  "極黑": "black_mage_extreme",
  "極黑魔法師": "black_mage_extreme",
  "(極)黑魔法師": "black_mage_extreme",

  // --- 瑪麗西亞 ---
  "瑪麗西亞": "maricia",
  "馬車": "maricia",
  "瑪車": "maricia"
};

module.exports = bossNameToIdMap;
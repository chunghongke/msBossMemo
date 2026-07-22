// config.js - BOSS與玩家角色設定檔
const bossesData = [
  { id: "lotus_normal", name: "史烏", maxPartySize: 2, difficulty: "normal", allowReset: true },
  { id: "lotus_hard", name: "(困)史烏", maxPartySize: 2, difficulty: "hard", allowReset: true },
  { id: "lotus_extreme", name: "(極)史烏", maxPartySize: 2, difficulty: "extreme", allowReset: true },

  { id: "damien_normal", name: "戴米安", maxPartySize: 6, difficulty: "normal", allowReset: true },
  { id: "damien_hard", name: "(困)戴米安", maxPartySize: 6, difficulty: "hard", allowReset: true },

  { id: "lucid_normal", name: "露希妲", maxPartySize: 6, difficulty: "normal", allowReset: true },
  { id: "lucid_hard", name: "(困)露希妲", maxPartySize: 6, difficulty: "hard", allowReset: true },

  { id: "will_normal", name: "威爾", maxPartySize: 6, difficulty: "normal", allowReset: true },
  { id: "will_hard", name: "(困)威爾", maxPartySize: 6, difficulty: "hard", allowReset: true },

  { id: "guardian_angel_slime_normal", name: "綠水靈", maxPartySize: 6, difficulty: "normal", allowReset: true },
  { id: "guardian_angel_slime_hard", name: "(困)綠水靈", maxPartySize: 6, difficulty: "hard", allowReset: true },

  { id: "verus_hilla_normal", name: "真希拉", maxPartySize: 6, difficulty: "normal", allowReset: true },
  { id: "verus_hilla_hard", name: "(困)真希拉", maxPartySize: 6, difficulty: "hard", allowReset: true },

  { id: "dunkel", name: "頓凱爾", maxPartySize: 6, difficulty: "normal", allowReset: true },
  { id: "dunkel_hard", name: "(困)頓凱爾", maxPartySize: 6, difficulty: "hard", allowReset: true },

  { id: "gloom_normal", name: "戴斯克", maxPartySize: 6, difficulty: "normal", allowReset: true },
  { id: "gloom_hard", name: "(困)戴斯克", maxPartySize: 6, difficulty: "hard", allowReset: true },

  { id: "seren_normal", name: "賽蓮", maxPartySize: 6, difficulty: "normal", allowReset: true },
  { id: "seren_hard", name: "(困)賽蓮", maxPartySize: 6, difficulty: "hard", allowReset: true },
  { id: "seren_extreme", name: "(極)賽蓮", maxPartySize: 6, difficulty: "extreme", allowReset: true },

  { id: "kalos_easy", name: "卡洛斯", maxPartySize: 6, difficulty: "easy", allowReset: true },
  { id: "kalos_normal", name: "卡洛斯", maxPartySize: 6, difficulty: "normal", allowReset: true },
  { id: "kalos_hard", name: "(困)卡洛斯", maxPartySize: 6, difficulty: "hard", allowReset: true },
  { id: "kalos_extreme", name: "(極)卡洛斯", maxPartySize: 6, difficulty: "extreme", allowReset: true },

  { id: "kaling_easy", name: "咖凌", maxPartySize: 6, difficulty: "easy", allowReset: true },
  { id: "kaling_normal", name: "咖凌", maxPartySize: 6, difficulty: "normal", allowReset: true },
  { id: "kaling_hard", name: "(困)咖凌", maxPartySize: 6, difficulty: "hard", allowReset: true },
  { id: "kaling_extreme", name: "(極)咖凌", maxPartySize: 6, difficulty: "extreme", allowReset: true },

  { id: "first_adversary_easy", name: "最初的敵對者", maxPartySize: 3, difficulty: "easy", allowReset: true },
  { id: "first_adversary_normal", name: "(普)最初的敵對者", maxPartySize: 3, difficulty: "normal", allowReset: true },
  { id: "first_adversary_hard", name: "(困)最初的敵對者", maxPartySize: 3, difficulty: "hard", allowReset: true },
  { id: "first_adversary_extreme", name: "(極)最初的敵對者", maxPartySize: 3, difficulty: "extreme", allowReset: true },

  { id: "radiant_star_normal", name: "燦爛的凶星", maxPartySize: 3, difficulty: "normal", allowReset: false },
  { id: "radiant_star_hard", name: "(困)燦爛的凶星", maxPartySize: 3, difficulty: "hard", allowReset: false },

  { id: "limbo_normal", name: "林波", maxPartySize: 3, difficulty: "normal", allowReset: true },
  { id: "limbo_hard", name: "(困)林波", maxPartySize: 3, difficulty: "hard", allowReset: true },

  { id: "baldrix_normal", name: "巴德利斯", maxPartySize: 3, difficulty: "normal", allowReset: true },
  { id: "baldrix_hard", name: "(困)巴德利斯", maxPartySize: 3, difficulty: "hard", allowReset: true },

  { id: "youpiter_normal", name: "尤比太", maxPartySize: 3, difficulty: "normal", allowReset: false },
  { id: "youpiter_hard", name: "(困)尤比太", maxPartySize: 3, difficulty: "hard", allowReset: false },

  { id: "black_mage_hard", name: "黑魔法師", maxPartySize: 6, difficulty: "hard", allowReset: true },
  { id: "black_mage_extreme", name: "(極)黑魔法師", maxPartySize: 6, difficulty: "extreme", allowReset: true },

  { id: "maricia", name: "瑪麗西亞", maxPartySize: 3, difficulty: "normal", allowReset: false },
];
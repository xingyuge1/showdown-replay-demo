# Showdown Coach 对战复盘演示

一页静态演示，展示一场 Pokémon Showdown Gen 9 OU 对局的逐回合复盘。使用回合进度条、前后按钮或曲线数据点，动画会暂停在所选回合行动前。正常播放时，进度条和曲线跟随播放器实际进入的回合。

- [同一场对局的官方动画回放](https://replay.pokemonshowdown.com/gen9ou-2718283592)
- 曲线来自该局模型方的赛后分析，每个点对应该回合行动前的胜率估计。终局赛果单独显示。
- 沙箱内嵌播放器载入 [Pokémon Showdown 官方客户端](https://github.com/smogon/pokemon-showdown-client) 的动画运行时，再读取该场公开回放中去除玩家名及非对战信息后的对战记录。演示数据包含这场对局的胜率曲线。

页面由 GitHub Pages 从 `main` 根目录提供。本地预览可在项目目录运行 `python -m http.server`，然后在浏览器打开终端显示的地址。动画资源需要联网。

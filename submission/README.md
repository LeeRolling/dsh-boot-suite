# 市场提交材料

给 DSH 插件市场用的两条数据，格式照 `yannicksong0106/dsh-550c-boot` 的 `submission/` 目录：

- `data/plugins/LeeRolling__dsh-boot-suite.yml` —— 登记条目（含 tarball 直链）
- `data/community/dsh-boot-suite.json` —— 社区展示条目

tarball 约定：release 里挂一个固定名字的资源

    https://github.com/LeeRolling/dsh-boot-suite/releases/latest/download/dsh-boot-suite.tgz

发布新版本时：改 `package.json` 版本 → `npm pack` → 把产物重命名为 `dsh-boot-suite.tgz` → 挂到对应 release。

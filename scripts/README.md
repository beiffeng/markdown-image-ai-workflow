# 发布脚本使用说明

## 📁 脚本概览

| 脚本文件 | 功能描述 | 使用场景 |
|---------|---------|---------|
| `publish.sh` | 一键发布插件到VSCode市场 | 正式发布新版本 |
| `version.sh` | 版本管理和标签操作 | 版本号管理、生成日志 |

## 🚀 快速开始

### 发布新版本
```bash
# 发布补丁版本 (推荐日常使用)
./scripts/publish.sh patch

# 发布功能版本
./scripts/publish.sh minor

# 发布重大版本
./scripts/publish.sh major
```

### 版本管理
```bash
# 查看当前版本
./scripts/version.sh current

# 手动更新版本号
./scripts/version.sh bump patch

# 检查版本一致性  
./scripts/version.sh check

# 生成更新日志
./scripts/version.sh changelog
```

## 📋 发布前准备

1. **确保环境就绪**
   - 已安装 `@vscode/vsce`
   - 已通过 `vsce login beifeng` 登录
   - Personal Access Token 有效

2. **代码质量检查**
   - 运行 `npm run compile` 无错误
   - 测试核心功能正常
   - 提交所有代码更改

3. **文档完整性**
   - README.md 内容更新
   - package.json 信息正确
   - 图标文件存在

## ⚠️ 安全注意

- **绝不在脚本中硬编码任何密钥或Token**
- 脚本会提示你手动登录，确保安全性
- 敏感信息通过交互式输入获取

## 🔧 脚本特性

### publish.sh
- ✅ 自动依赖检查
- ✅ Git状态验证
- ✅ 编译错误检测
- ✅ 文件完整性检查
- ✅ 版本自动更新
- ✅ 本地打包测试
- ✅ 市场发布
- ✅ Git提交和标签创建
- ✅ 彩色日志输出

### version.sh
- ✅ 语义化版本管理
- ✅ Git标签同步
- ✅ 版本一致性检查
- ✅ 自动更新日志生成
- ✅ 交互式确认

## 📊 使用统计

运行脚本后会自动记录发布历史，方便追踪版本发布情况。

---

💡 **提示**: 建议先在测试环境使用脚本，熟悉操作流程后再用于正式发布。
# VSCode插件发布指南

## 📋 发布前检查清单

### 🔧 环境准备
- [ ] 确保已安装最新版本的 `@vscode/vsce`
- [ ] 拥有有效的Azure DevOps Personal Access Token
- [ ] 发布者账户：`beifeng`

### 📝 代码质量检查
- [ ] 运行 `npm run compile` 确保无编译错误
- [ ] 测试主要功能（至少测试一个图床服务）
- [ ] 检查README.md文档完整性
- [ ] 验证package.json版本号正确

### 🎨 资源文件检查
- [ ] 图标文件 `icons/icon.png` 存在且为128x128
- [ ] 图标在不同主题下显示正常
- [ ] LICENSE文件完整

## 🚀 发布流程

### 方法一：使用一键发布脚本（推荐）
```bash
./scripts/publish.sh
```

### 方法二：手动发布步骤

#### 1. 登录发布者账户
```bash
vsce login beifeng
```
> 提示：输入你的Personal Access Token

#### 2. 版本更新（可选）
```bash
# 补丁版本 (0.1.0 -> 0.1.1)
npm version patch

# 次版本 (0.1.0 -> 0.2.0)  
npm version minor

# 主版本 (0.1.0 -> 1.0.0)
npm version major
```

#### 3. 本地打包测试
```bash
vsce package
```
检查生成的.vsix文件大小和内容是否合理

#### 4. 发布到市场
```bash
vsce publish
```

#### 5. 推送Git更改
```bash
git push origin main
git push origin --tags
```

## 📊 发布后验证

### 市场验证
- [ ] 在VSCode市场搜索插件名称
- [ ] 检查插件页面信息显示正确
- [ ] 验证图标和描述
- [ ] 测试从市场安装插件

### 功能验证
- [ ] 安装后插件正常激活
- [ ] 配置页面可正常访问
- [ ] 核心功能工作正常

## ⚠️ 注意事项

### 安全要求
- **绝不在代码或脚本中硬编码Personal Access Token**
- 确保敏感配置文件已在.gitignore中排除
- 发布前检查是否意外包含测试密钥

### 版本管理
- 遵循语义化版本控制 (Semantic Versioning)
- 发布后的版本无法撤销，请谨慎操作
- 重大变更应该增加主版本号

### 发布频率
- Bug修复：及时发布补丁版本
- 新功能：规划好功能集合后发布次版本
- 重大重构：谨慎规划主版本发布

## 🔗 有用链接

- [VSCode扩展市场](https://marketplace.visualstudio.com/)
- [插件管理页面](https://marketplace.visualstudio.com/manage/publishers/beifeng)
- [vsce官方文档](https://code.visualstudio.com/api/working-with-extensions/publishing-extension)
- [语义化版本规范](https://semver.org/)

## 📞 问题排查

### 常见发布错误
1. **图标文件找不到**: 检查icons/icon.png是否存在
2. **版本兼容性错误**: 确保engines.vscode与@types/vscode版本匹配
3. **Token验证失败**: 检查Personal Access Token权限和有效期
4. **文件过大**: 检查.vscodeignore配置，排除不必要文件

### 紧急回滚
如果发布后发现严重问题：
1. 立即发布修复版本（增加补丁号）
2. 不要尝试删除已发布版本
3. 在市场页面添加已知问题说明

---

📝 **最后更新**: 2025年7月
🔧 **维护者**: beifeng
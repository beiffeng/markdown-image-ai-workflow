# Markdown Image Flow

[![Version](https://img.shields.io/badge/version-0.1.0-blue.svg)](https://github.com/your-username/markdown-image-flow)
[![VSCode](https://img.shields.io/badge/VSCode-1.79+-green.svg)](https://code.visualstudio.com/)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

> **让 Markdown 图片处理如流水般顺畅**  
> 专为 Markdown 写作优化的多平台图片流程管理工具，支持智能上传、同步处理

## ✨ 核心特性

### 🌊 **流畅体验**
- **一键粘贴** - 图片粘贴后自动处理，无需手动操作
- **智能同步** - 多平台图床同步，数据永不丢失  
- **无缝集成** - 完全基于 VSCode 原生特性，零学习成本

### 🎯 **智能化**
- **路径智能解析** - 支持所有 VSCode 路径变量和复杂规则
- **自动链接替换** - 精确匹配和替换 Markdown 图片引用
- **光标智能定位** - 处理完成后自动定位到最佳位置

### 🚀 **多平台支持**
- **SM.MS** - 零配置即用，稳定可靠
- **GitHub** - 私有仓库支持，完全掌控
- **Cloudinary** - 专业 CDN 服务（规划中）
- **更多平台** - 持续扩展中...

### 🔮 **未来展望** 
- **AI 智能标记** - 自动生成图片 alt text
- **内容识别** - 基于图片内容智能分类
- **多语言支持** - AI 驱动的多语言描述生成

## 🚀 快速开始

### 1️⃣ 安装插件

从 VSCode 扩展市场搜索 **"Markdown Image Flow"** 并安装。

### 2️⃣ 配置图片流程（推荐）

使用命令面板 (`Ctrl+Shift+P`) 运行：
```
Markdown Image Flow: 设置推荐配置
```

或手动配置 VSCode 设置：
```json
{
  "markdown.copyFiles.destination": {
    "**/*.md": "assets/${documentBaseName}/"
  },
  "markdown.editor.drop.copyIntoWorkspace": "mediaFiles",
  "markdown.editor.filePaste.copyIntoWorkspace": "mediaFiles"
}
```

### 3️⃣ 选择图床平台

#### 🎯 SM.MS（推荐入门）
```json
{
  "markdownImageFlow.provider": "smms"
  // 可选：配置 API Token 获得更高限制
  // "markdownImageFlow.smms.token": "your-token-here"
}
```

#### 🔒 GitHub（私有控制）
```json
{
  "markdownImageFlow.provider": "github",
  "markdownImageFlow.github.repo": "username/your-repo",
  "markdownImageFlow.github.token": "ghp_your-token-here",
  "markdownImageFlow.github.branch": "main"
}
```

### 4️⃣ 开始流畅写作

1. 📝 在 Markdown 文件中写作
2. 📷 粘贴图片 (`Ctrl+V`)
3. ⚡ 自动上传处理
4. 🔗 链接自动替换
5. ✨ 继续专注写作

## 🎮 命令面板

| 命令 | 功能 | 快捷键 |
|------|------|--------|
| `Markdown Image Flow: 检查配置` | 诊断配置问题 | - |
| `Markdown Image Flow: 设置推荐配置` | 一键优化配置 | - |
| `Markdown Image Flow: 上传当前图片` | 手动上传图片 | - |

## ⚙️ 完整配置选项

### 🎛️ 核心配置
```json
{
  // 启用状态
  "markdownImageFlow.enabled": true,
  
  // 图床选择
  "markdownImageFlow.provider": "smms", // "smms" | "github" | "cloudinary"
  
  // 处理策略  
  "markdownImageFlow.respectVSCodeConfig": true,
  "markdownImageFlow.fallbackBehavior": "sameDirectory", // "sameDirectory" | "disable" | "prompt"
  
  // 清理选项
  "markdownImageFlow.deleteLocalAfterUpload": false
}
```

### 🌐 图床平台配置
```json
{
  // SM.MS 配置
  "markdownImageFlow.smms.token": "",
  
  // GitHub 配置  
  "markdownImageFlow.github.repo": "username/repo",
  "markdownImageFlow.github.token": "ghp_xxxxxxxxxxxx",
  "markdownImageFlow.github.branch": "main"
}
```

## 🎨 高级路径配置

支持所有 VSCode 路径变量，实现复杂的文件组织：

```json
{
  "markdown.copyFiles.destination": {
    // 📁 按文档分类
    "**/*.md": "assets/${documentBaseName}/",
    
    // 📅 按项目分类  
    "/blog/**/*.md": "static/images/${documentBaseName}/",
    "/docs/**/*.md": "public/assets/",
    
    // 🏷️ 按类型分类
    "/tutorials/**/*.md": "media/tutorials/${documentDirName}/",
    
    // 📊 统一管理
    "/wiki/**/*.md": "images/"
  }
}
```

### 📖 支持的变量
- `${documentBaseName}` - 文档名（不含扩展名）
- `${documentFileName}` - 完整文档名  
- `${documentDirName}` - 文档目录名
- `${documentWorkspaceFolder}` - 工作区根路径
- `${fileName}` - 图片文件名

## 🚦 状态监控

状态栏实时显示插件状态：

| 状态 | 含义 |
|------|------|
| `🌊 SM.MS` | 正常运行，使用 SM.MS |
| `🌊 GitHub` | 正常运行，使用 GitHub |
| `⚙️ 需要配置` | 配置不完整 |
| `⏸️ 已禁用` | 插件已禁用 |
| `✅ 上传成功` | 刚完成上传 |

## 🔧 故障排除

### ❓ 常见问题

<details>
<summary><strong>插件没有响应？</strong></summary>

1. 检查 VSCode 版本（需要 1.79+）
2. 运行"检查配置"命令诊断
3. 查看状态栏显示的状态
4. 检查开发者工具控制台（`Help → Toggle Developer Tools`）
</details>

<details>
<summary><strong>图片没有自动上传？</strong></summary>

1. 确认是在 `.md` 文件中操作
2. 检查图片格式（支持 .png, .jpg, .gif, .webp, .svg）
3. 验证 `markdown.copyFiles.destination` 配置
4. 确认图床服务配置正确
</details>

<details>
<summary><strong>链接替换不准确？</strong></summary>

1. 检查 Markdown 语法是否标准 `![alt](path)`
2. 确认文件名匹配
3. 尝试手动上传命令
4. 查看控制台错误信息
</details>

## 🗺️ 发展路线图

### 🚀 即将到来
- [ ] **AI 智能标记** - 自动生成图片描述
- [ ] **Cloudinary 集成** - 专业 CDN 支持
- [ ] **批量处理** - 一键处理多张图片
- [ ] **历史记录** - 上传历史管理

### 🌟 长远规划  
- [ ] **内容识别** - 基于 AI 的图片分类
- [ ] **多语言描述** - AI 生成多语言 alt text
- [ ] **性能优化** - 图片自动压缩
- [ ] **团队协作** - 共享图床配置

## 🤝 参与贡献

我们欢迎任何形式的贡献！

- 🐛 **报告问题** - [GitHub Issues](https://github.com/your-username/markdown-image-flow/issues)
- 💡 **功能建议** - [GitHub Discussions](https://github.com/your-username/markdown-image-flow/discussions)
- 🔧 **代码贡献** - [Pull Requests](https://github.com/your-username/markdown-image-flow/pulls)

## 📄 开源协议

本项目采用 [MIT License](LICENSE) 开源协议。

## 🙏 特别感谢

- **VSCode 团队** - 提供强大的编辑器平台
- **开源社区** - 提供优秀的依赖库
- **用户反馈** - 帮助我们持续改进

---

<div align="center">

**让 Markdown 写作更加流畅** ✨

[⭐ Star](https://github.com/your-username/markdown-image-flow) | [🐛 报告问题](https://github.com/your-username/markdown-image-flow/issues) | [💬 讨论](https://github.com/your-username/markdown-image-flow/discussions)

</div>

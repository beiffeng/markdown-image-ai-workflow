# 腾讯云COS上传调试指南

## 🔍 问题诊断

如果生成了URL但文件没有上传到腾讯云，请按以下步骤检查：

### 1. 检查控制台日志
打开VSCode开发者控制台，查看以下关键日志：
```
MarkdownImageFlow: 初始化COS客户端...
MarkdownImageFlow: 开始上传到COS: images/2025/01/filename.png
MarkdownImageFlow: 检查文件是否存在: images/2025/01/filename.png
MarkdownImageFlow: 文件不存在，可以上传
MarkdownImageFlow: 准备上传文件: {...}
MarkdownImageFlow: COS上传进度: 100%
MarkdownImageFlow: COS上传成功详情: {...}
```

### 2. 常见错误和解决方案

#### 权限问题 (403 Forbidden)
**错误特征：** 看到 "AccessDenied" 或 "权限不足"
**解决方案：**
1. 确认SecretId和SecretKey正确
2. 检查API密钥权限：
   - 登录腾讯云控制台
   - 进入"访问管理" → "API密钥管理"
   - 确保密钥有COS相关权限

#### 存储桶问题 (404 Not Found)
**错误特征：** 看到 "NoSuchBucket"
**解决方案：**
1. 检查Bucket名称格式：必须是 `bucketname-appid` 格式
2. 确认Region设置正确
3. 确认存储桶在指定Region中存在

#### 签名问题
**错误特征：** 看到 "SignatureDoesNotMatch"
**解决方案：**
1. 重新检查SecretKey是否正确
2. 确保没有多余的空格
3. 尝试重新生成API密钥

### 3. 验证配置
运行配置测试：
1. 按 `Cmd+Shift+P` 打开命令面板
2. 输入 "Markdown Image Flow"
3. 选择配置向导并测试COS配置

### 4. 手动验证
如果问题持续，可以手动验证：
1. 使用腾讯云官方工具上传测试文件
2. 确认存储桶的访问权限设置
3. 检查存储桶的CORS设置（如果需要）

### 5. 网络问题
如果在国外或网络环境特殊：
1. 尝试不同的Region
2. 检查防火墙设置
3. 考虑使用代理配置

## 🛠️ 调试技巧

### 启用详细日志
代码已添加详细的调试日志，包括：
- 客户端初始化状态
- 文件检查过程
- 上传进度
- 错误详情
- 验证结果

### 检查实际的API调用
所有关键信息都会在控制台输出，包括：
- 使用的Bucket和Region
- 生成的文件路径
- 上传进度和结果
- 任何错误的详细信息

请按照这个指南操作，并将控制台的具体错误信息反馈给我，我可以提供更精确的解决方案。
import * as vscode from 'vscode';

/**
 * 配置引导工具
 */
export class ConfigurationGuide {
  /**
   * 显示首次使用引导
   */
  async showWelcomeGuide(): Promise<void> {
    const message = `
🎉 欢迎使用 Markdown Image Flow！

这个插件基于VSCode原生的 markdown.copyFiles.destination 特性，
自动将粘贴的图片上传到图床并替换为远程链接。

要开始使用，请确保：
1. 配置了 markdown.copyFiles.destination
2. 选择并配置了图床服务
`;

    const choice = await vscode.window.showInformationMessage(
      message,
      '立即配置',
      '查看文档',
      '稍后'
    );

    switch (choice) {
      case '立即配置':
        await this.startConfigurationWizard();
        break;
      case '查看文档':
        await this.openDocumentation();
        break;
    }
  }

  /**
   * 启动配置向导
   */
  async startConfigurationWizard(): Promise<void> {
    // 步骤1：检查VSCode配置
    const vsCodeConfigured = await this.checkAndConfigureVSCode();
    if (!vsCodeConfigured) {
      return;
    }

    // 步骤2：配置图床服务
    await this.configureImageFlow();

    // 步骤3：完成配置
    await this.showConfigurationComplete();
  }

  /**
   * 检查并配置VSCode
   */
  private async checkAndConfigureVSCode(): Promise<boolean> {
    const config = vscode.workspace.getConfiguration();
    const destination = config.get('markdown.copyFiles.destination');

    if (!destination) {
      const choice = await vscode.window.showInformationMessage(
        '需要先配置VSCode的图片保存位置。是否使用推荐配置？',
        '使用推荐配置',
        '手动配置',
        '取消'
      );

      if (choice === '使用推荐配置') {
        try {
          await config.update(
            'markdown.copyFiles.destination',
            { '**/*.md': 'assets/${documentBaseName}/' },
            vscode.ConfigurationTarget.Workspace
          );
          
          vscode.window.showInformationMessage(
            '✅ VSCode配置已设置：图片将保存到 assets/{文档名}/ 目录'
          );
          return true;
        } catch (error) {
          vscode.window.showErrorMessage('设置失败：' + error);
          return false;
        }
      } else if (choice === '手动配置') {
        await vscode.commands.executeCommand('workbench.action.openSettings', 'markdown.copyFiles.destination');
        return false;
      } else {
        return false;
      }
    }

    return true;
  }

  /**
   * 配置图床服务
   */
  private async configureImageFlow(): Promise<void> {
    const providers = [
      {
        label: '$(github) GitHub',
        description: '推荐 - GitHub仓库图床',
        detail: '稳定可靠，需要配置仓库名称和Personal Access Token',
        provider: 'github'
      },
      {
        label: '$(cloud) 腾讯云COS',
        description: '适合国内用户',
        detail: '腾讯云对象存储，访问速度快，需要配置SecretId、SecretKey和Bucket',
        provider: 'cos'
      },
      {
        label: '$(cloud) SM.MS',
        description: '⚠️ 不推荐（已停止注册）',
        detail: '已关闭新用户注册，仅供现有用户使用',
        provider: 'smms'
      }
    ];

    const choice = await vscode.window.showQuickPick(providers, {
      title: '选择图床服务',
      placeHolder: '推荐使用GitHub图床，稳定可靠且长期可用'
    });

    if (choice) {
      const config = vscode.workspace.getConfiguration('markdownImageFlow');
      await config.update('provider', choice.provider, vscode.ConfigurationTarget.Global);

      if (choice.provider === 'github') {
        await this.configureGitHub();
      } else if (choice.provider === 'cos') {
        await this.configureCOS();
      } else if (choice.provider === 'smms') {
        await this.configureSMMS();
      }
    }
  }

  /**
   * 配置GitHub
   */
  private async configureGitHub(): Promise<void> {
    const repo = await vscode.window.showInputBox({
      title: '配置GitHub仓库',
      prompt: '请输入GitHub仓库名称（格式：username/repo）',
      placeHolder: 'username/repo'
    });

    if (!repo) return;

    const token = await vscode.window.showInputBox({
      title: '配置GitHub Token',
      prompt: '请输入GitHub Personal Access Token',
      placeHolder: 'ghp_xxxxxxxxxxxx',
      password: true
    });

    if (!token) return;

    const config = vscode.workspace.getConfiguration('markdownImageFlow.github');
    await config.update('repo', repo, vscode.ConfigurationTarget.Global);
    await config.update('token', token, vscode.ConfigurationTarget.Global);

    vscode.window.showInformationMessage('✅ GitHub配置已保存');
  }

  /**
   * 配置SM.MS
   */
  private async configureSMMS(): Promise<void> {
    const choice = await vscode.window.showWarningMessage(
      '⚠️ SM.MS已停止新用户注册且停止匿名上传。仅现有用户可配置API Token使用。建议选择GitHub图床方案。',
      '我有SM.MS账户，继续配置',
      '取消'
    );

    if (choice === '我有SM.MS账户，继续配置') {
      const token = await vscode.window.showInputBox({
        title: '配置SM.MS Token',
        prompt: '请输入SM.MS API Token（可在 https://sm.ms/home/apitoken 获取）',
        placeHolder: 'API Token'
      });

      if (token) {
        const config = vscode.workspace.getConfiguration('markdownImageFlow.smms');
        await config.update('token', token, vscode.ConfigurationTarget.Global);
        vscode.window.showInformationMessage('✅ SM.MS Token已保存');
      }
    }

    if (choice === '我有SM.MS账户，继续配置') {
      vscode.window.showInformationMessage('✅ SM.MS Token配置完成，现在可以使用');
    } else {
      vscode.window.showInformationMessage('ℹ️ 建议使用GitHub作为图床方案，更稳定可靠');
    }
  }

  /**
   * 配置腾讯云COS
   */
  private async configureCOS(): Promise<void> {
    // 步骤1：输入SecretId
    const secretId = await vscode.window.showInputBox({
      title: '配置腾讯云COS - SecretId',
      prompt: '请输入腾讯云API密钥ID (SecretId)',
      placeHolder: 'AKxxxxxxxxxxxxxxxxxxxxxxxxxxx...',
      ignoreFocusOut: true,
      validateInput: (value) => {
        if (!value || value.trim().length === 0) {
          return 'SecretId不能为空';
        }
        if (value.length < 20) {
          return 'SecretId格式不正确，长度太短';
        }
        return null;
      }
    });

    if (!secretId) return;

    // 步骤2：输入SecretKey
    const secretKey = await vscode.window.showInputBox({
      title: '配置腾讯云COS - SecretKey',
      prompt: '请输入腾讯云API密钥Key (SecretKey)',
      placeHolder: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
      password: true,
      ignoreFocusOut: true,
      validateInput: (value) => {
        if (!value || value.trim().length === 0) {
          return 'SecretKey不能为空';
        }
        if (value.length < 20) {
          return 'SecretKey格式不正确，长度太短';
        }
        return null;
      }
    });

    if (!secretKey) return;

    // 步骤3：输入Bucket名称
    const bucket = await vscode.window.showInputBox({
      title: '配置腾讯云COS - Bucket',
      prompt: '请输入COS存储桶名称',
      placeHolder: 'my-bucket-1234567890',
      ignoreFocusOut: true,
      validateInput: (value) => {
        if (!value || value.trim().length === 0) {
          return 'Bucket名称不能为空';
        }
        if (!/^[a-zA-Z0-9.-]+-\d+$/.test(value)) {
          return 'Bucket名称格式错误，应为 bucketname-appid 格式';
        }
        return null;
      }
    });

    if (!bucket) return;

    // 步骤4：选择地域
    const regions = [
      { label: '广州 (ap-guangzhou)', value: 'ap-guangzhou' },
      { label: '上海 (ap-shanghai)', value: 'ap-shanghai' },
      { label: '北京 (ap-beijing)', value: 'ap-beijing' },
      { label: '成都 (ap-chengdu)', value: 'ap-chengdu' },
      { label: '重庆 (ap-chongqing)', value: 'ap-chongqing' },
      { label: '香港 (ap-hongkong)', value: 'ap-hongkong' },
      { label: '新加坡 (ap-singapore)', value: 'ap-singapore' },
      { label: '东京 (ap-tokyo)', value: 'ap-tokyo' },
      { label: '硅谷 (na-siliconvalley)', value: 'na-siliconvalley' },
      { label: '法兰克福 (eu-frankfurt)', value: 'eu-frankfurt' }
    ];

    const regionChoice = await vscode.window.showQuickPick(regions, {
      title: '选择COS存储桶地域',
      placeHolder: '请选择最接近您的地域以获得最佳访问速度'
    });

    if (!regionChoice) return;

    // 步骤5：可选的路径前缀
    const pathPrefix = await vscode.window.showInputBox({
      title: '配置腾讯云COS - 路径前缀 (可选)',
      prompt: '设置图片存储的路径前缀，留空则使用默认值',
      placeHolder: 'images/ (推荐)',
      value: 'images/',
      ignoreFocusOut: true
    });

    // 保存配置
    const config = vscode.workspace.getConfiguration('markdownImageFlow.cos');
    await config.update('secretId', secretId, vscode.ConfigurationTarget.Global);
    await config.update('secretKey', secretKey, vscode.ConfigurationTarget.Global);
    await config.update('bucket', bucket, vscode.ConfigurationTarget.Global);
    await config.update('region', regionChoice.value, vscode.ConfigurationTarget.Global);
    
    if (pathPrefix !== undefined && pathPrefix.trim() !== '') {
      await config.update('path', pathPrefix, vscode.ConfigurationTarget.Global);
    }

    // 测试配置
    const testChoice = await vscode.window.showInformationMessage(
      '✅ 腾讯云COS配置已保存！是否要测试配置是否正确？',
      '测试配置',
      '跳过测试'
    );

    if (testChoice === '测试配置') {
      try {
        // 导入COS上传器进行测试
        const { COSUploader } = require('../uploaders/cos.uploader');
        const cosUploader = new COSUploader();
        
        vscode.window.showInformationMessage('🔄 正在测试COS配置...');
        const validationResult = await cosUploader.validateConfig();
        
        if (validationResult.valid) {
          vscode.window.showInformationMessage('✅ COS配置测试成功！现在可以使用腾讯云COS上传图片了');
        } else {
          vscode.window.showErrorMessage(`❌ COS配置测试失败: ${validationResult.error}`);
        }
      } catch (error) {
        vscode.window.showWarningMessage('⚠️ 无法测试配置，但配置已保存。请尝试上传图片验证功能');
      }
    } else {
      vscode.window.showInformationMessage('✅ 腾讯云COS配置完成！');
    }

    // 显示使用提示
    await vscode.window.showInformationMessage(
      `🎯 提示：图片将上传到 ${bucket}.cos.${regionChoice.value}.myqcloud.com/${pathPrefix || 'images/'}YYYY/MM/filename.ext`,
      '了解了'
    );
  }

  /**
   * 显示配置完成
   */
  private async showConfigurationComplete(): Promise<void> {
    const message = `
✅ 配置完成！

现在您可以：
1. 在Markdown文件中粘贴图片
2. 插件会自动上传到图床并替换链接
3. 光标会自动定位到图片链接末尾

状态栏会显示插件状态，点击可查看详细信息。
`;

    const choice = await vscode.window.showInformationMessage(
      message,
      '开始使用',
      '查看设置'
    );

    if (choice === '查看设置') {
      await vscode.commands.executeCommand('workbench.action.openSettings', 'markdownImageFlow');
    }
  }

  /**
   * 打开文档
   */
  private async openDocumentation(): Promise<void> {
    // 这里可以打开项目的README或在线文档
    vscode.env.openExternal(vscode.Uri.parse('https://github.com/beiffeng/markdown-image-flow'));
  }

  /**
   * 显示VSCode配置问题的帮助
   */
  async showVSCodeConfigHelp(): Promise<void> {
    const items = [
      {
        label: '$(gear) 打开VSCode设置',
        description: '手动配置 markdown.copyFiles.destination'
      },
      {
        label: '$(rocket) 使用推荐配置',
        description: '自动应用最佳实践配置'
      },
      {
        label: '$(question) 什么是 markdown.copyFiles.destination？',
        description: '了解VSCode原生图片处理功能'
      }
    ];

    const choice = await vscode.window.showQuickPick(items, {
      title: 'VSCode图片配置帮助',
      placeHolder: '选择您需要的帮助'
    });

    switch (choice?.label) {
      case '$(gear) 打开VSCode设置':
        await vscode.commands.executeCommand('workbench.action.openSettings', 'markdown.copyFiles');
        break;
      
      case '$(rocket) 使用推荐配置':
        await this.checkAndConfigureVSCode();
        break;
      
      case '$(question) 什么是 markdown.copyFiles.destination？':
        await this.showVSCodeFeatureExplanation();
        break;
    }
  }

  /**
   * 解释VSCode功能
   */
  private async showVSCodeFeatureExplanation(): Promise<void> {
    const explanation = `
📖 关于 markdown.copyFiles.destination

这是VSCode 1.79+版本的原生功能，用于控制在Markdown文件中粘贴图片时的保存位置。

配置示例：
{
  "markdown.copyFiles.destination": {
    "**/*.md": "assets/\${documentBaseName}/"
  }
}

支持的变量：
• \${documentBaseName} - 文档名称（不含扩展名）
• \${documentFileName} - 完整文档名称
• \${documentDirName} - 文档所在目录名
• \${documentWorkspaceFolder} - 工作区路径

本插件完全基于这个功能，在VSCode保存图片后自动上传到图床。
`;

    await vscode.window.showInformationMessage(explanation, '了解了');
  }
}
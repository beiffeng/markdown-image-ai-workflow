"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SMSUploader = void 0;
const vscode = require("vscode");
const fs = require("fs");
const node_fetch_1 = require("node-fetch");
const FormData = require("form-data");
/**
 * SM.MS图床上传器
 * 官方文档: https://doc.sm.ms/
 */
class SMSUploader {
    constructor() {
        this.name = 'SM.MS';
        this.API_URL = 'https://sm.ms/api/v2/upload';
        this.MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
    }
    /**
     * 上传图片到SM.MS
     */
    async upload(filePath) {
        try {
            // 检查文件大小
            const stats = await fs.promises.stat(filePath);
            if (stats.size > this.MAX_FILE_SIZE) {
                return {
                    success: false,
                    error: `文件大小超过限制（${this.MAX_FILE_SIZE / 1024 / 1024}MB）`,
                    provider: this.name
                };
            }
            // 读取文件
            const fileBuffer = await fs.promises.readFile(filePath);
            const fileName = filePath.split('/').pop() || 'image';
            // 准备FormData
            const formData = new FormData();
            formData.append('smfile', fileBuffer, {
                filename: fileName,
                contentType: 'image/' + fileName.split('.').pop()?.toLowerCase()
            });
            // 获取API Token（可选）
            const config = vscode.workspace.getConfiguration('markdownImageFlow.smms');
            const token = config.get('token');
            console.log('MarkdownImageFlow: SM.MS Token配置:', token ? '已配置' : '未配置');
            const headers = {
                'User-Agent': 'VSCode-ImageBedUploader/1.0',
                ...formData.getHeaders()
            };
            if (token) {
                headers['Authorization'] = token;
                console.log('MarkdownImageFlow: 使用API Token上传');
            }
            else {
                console.log('MarkdownImageFlow: 使用匿名上传');
            }
            // 使用fetch发送请求
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 30000);
            const response = await (0, node_fetch_1.default)(this.API_URL, {
                method: 'POST',
                headers,
                body: formData,
                signal: controller.signal
            });
            clearTimeout(timeoutId);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const responseData = await response.json();
            console.log('MarkdownImageFlow: SM.MS响应数据:', JSON.stringify(responseData, null, 2));
            // 处理响应
            if (responseData.success) {
                return {
                    success: true,
                    url: responseData.data.url,
                    provider: this.name
                };
            }
            else {
                // SM.MS返回了错误信息
                let errorMsg = responseData.message || '上传失败';
                // 处理常见错误信息
                if (responseData.code === 'image_repeated') {
                    // 图片重复，返回已存在的URL
                    if (responseData.images) {
                        return {
                            success: true,
                            url: responseData.images,
                            provider: this.name
                        };
                    }
                    errorMsg = '图片已存在';
                }
                else if (responseData.code === 'unauthorized') {
                    errorMsg = 'API Token无效或已过期';
                }
                else if (responseData.code === 'flood') {
                    errorMsg = '上传过于频繁，请稍后再试';
                }
                return {
                    success: false,
                    error: errorMsg,
                    provider: this.name
                };
            }
        }
        catch (error) {
            console.error('MarkdownImageFlow: SM.MS上传失败:', error);
            let errorMsg = '上传失败';
            if (error instanceof Error) {
                if (error.name === 'AbortError') {
                    errorMsg = '上传超时，请检查网络连接';
                }
                else if (error.message.includes('413')) {
                    errorMsg = '文件过大';
                }
                else if (error.message.includes('5')) {
                    errorMsg = 'SM.MS服务器错误，请稍后再试';
                }
                else {
                    errorMsg = error.message;
                }
            }
            return {
                success: false,
                error: errorMsg,
                provider: this.name
            };
        }
    }
    /**
     * 检查是否已配置
     */
    isConfigured() {
        // SM.MS不需要必须配置Token，但配置了会有更高的限制
        return true;
    }
    /**
     * 获取配置状态信息
     */
    getConfigStatus() {
        const config = vscode.workspace.getConfiguration('imageBedUploader.smms');
        const token = config.get('token');
        const hasToken = !!token;
        return {
            hasToken,
            status: hasToken
                ? '已配置API Token，享受更高上传限制'
                : '未配置API Token，使用游客限制'
        };
    }
}
exports.SMSUploader = SMSUploader;
//# sourceMappingURL=smms.uploader.js.map
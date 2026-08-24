# 把「物品库存清单」打包成安卓 APK

本项目是一个纯前端的网页应用（HTML/CSS/JS + 浏览器本地存储），通过 **Capacitor** 把它包进安卓 WebView，就能生成可以直接安装到安卓手机的 `.apk` 安装包。应用数据全部存在手机本地，**无需联网、无需账号**。

> ⚠️ 编译 APK 需要 Java + Android 构建工具链，WorkBuddy 的运行沙箱里没有这些，所以**下面的命令要在你自己的 Windows/Mac 电脑的终端里执行**（不是聊天框里）。

---

## 一、在你电脑上安装前置工具

1. **Node.js 18+**（自带 npm）：https://nodejs.org  → 安装时一路下一步即可
2. **Java JDK 17**：https://adoptium.net  → 下载 "Temurin 17 LTS" 安装
3. **Android Studio**：https://developer.android.com/studio
   - 首次启动选 "Standard" 安装，会自动装好 Android SDK
   - 装完后打开 `Tools → SDK Manager`，确认已勾选：
     - Android SDK Platform（API 34 或更高）
     - Android SDK Build-Tools
     - Android SDK Platform-Tools
   - 配置环境变量（以 Windows 为例）：
     - 新建系统变量 `ANDROID_HOME` = `C:\Users\你的用户名\AppData\Local\Android\Sdk`
     - 在 `Path` 里追加 `%ANDROID_HOME%\platform-tools` 和 `%ANDROID_HOME%\cmdline-tools\latest\bin`
   - 打开新的终端，输入 `adb version` 能显示版本即配置成功

4. 把本项目整个文件夹拷贝到你的电脑上（保持目录结构）。

---

## 二、生成安卓工程并打包 APK

在**项目根目录**打开终端，依次执行：

```bash
# 1. 安装依赖（首次执行，会下载 capacitor）
npm install

# 2. 把网页文件复制到 www/ 目录
npm run build:www

# 3. 生成安卓工程目录 android/（只需执行一次）
npm run android:add

# 4. 把最新网页同步进安卓工程
npm run android:sync

# 5. 用 Android Studio 打开安卓工程
npm run android:open
```

在 Android Studio 里生成可安装的 APK：

1. 菜单 `Build → Generate Signed Bundle / APK`
2. 选择 **APK** → Next
3. 第一次需要创建密钥（Key store）：
   - 点 "Create new…"，填密码、别名、有效期（建议 25 年）、你的姓名
   - 把密钥文件（`.jks`）保存好，**以后更新 App 必须用同一个密钥**
4. 选 **release** 构建变体 → Finish
5. 等待编译完成，APK 生成在：
   ```
   android/app/release/app-release.apk
   ```

把 `app-release.apk` 传到安卓手机，在手机上允许"安装未知来源应用"即可完成安装。

---

## 三、之后每次改了网页内容

只需要重新同步并重新打包：

```bash
npm run android:sync      # 重新把网页复制进安卓工程
npm run android:open      # 回到 Android Studio 重新 Build APK
```

或在 Android Studio 里直接点 `Build → Generate Signed Bundle / APK`。

---

## 四、想直接调试到手机（可选）

把安卓手机用 USB 连电脑，手机开启 `设置 → 关于手机 → 连点版本号` 打开开发者选项，再开启 `USB 调试`。然后在 Android Studio 顶部点 Run ▶，选择你的手机即可直接安装运行（无需先生成 APK）。

---

## 五、还不想装 Android Studio？先用 PWA 顶着

我们的网页本身已经是 PWA，在**安卓 Chrome** 里就能变成全屏、有图标、可离线使用的 App，完全不需要 APK：

1. 手机和电脑连同一个 WiFi
2. 手机 Chrome 打开 `http://<电脑内网IP>:8000`
3. 点右上角菜单（⋮）→ **"安装应用"**（或"添加到主屏幕"）
4. 桌面就会出现「库存清单」图标，点开就是 App

这种方式今天就能用；想分发 APK 给朋友时，再走上面第二、三节的流程即可。

---

## 常见问题

- **`cap` 命令找不到？** 先 `npm install -g @capacitor/cli`，或用 `npx cap ...`。
- **`ANDROID_HOME` 报错？** 确认环境变量指向的 SDK 路径真实存在，并重启终端。
- **数据会丢吗？** 数据存在手机浏览器 WebView 的本地数据库（IndexedDB），重装 APK 会清空，建议以后加入"导出备份"功能。
- **图标/名称想改？** 编辑 `capacitor.config.json` 里的 `appName`、`appId`；图标替换 `icons/` 下文件后重新 `android:sync`。

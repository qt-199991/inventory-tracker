# 个人物品库存清单 · SpringBoot 后端 · 服务器零基础部署指南

> 适用：轻量云服务器（1~2 核 2G 即可）。系统以 **Ubuntu 22.04** 为主，`# CentOS` 标注处给出等价命令。
> 技术栈：Spring Boot 3.2 + Java 17 + MySQL 8.0 + 内嵌 Tomcat（端口 8080）+ Nginx 反代。
> 约定：jar 包名为 `inventory.jar`，生产环境用 `prod` 配置，API 前缀 `/api`。请按实际包名/域名替换。

---

## 0. 部署前准备（一次性）

```bash
# 升级系统
sudo apt update && sudo apt upgrade -y          # CentOS: sudo dnf update -y

# 安装基础工具
sudo apt install -y curl wget unzip vim git ufw # CentOS: sudo dnf install -y curl wget vim git firewalld

# 创建专用运行目录
sudo mkdir -p /opt/inventory && sudo chown -R $USER:$USER /opt/inventory
cd /opt/inventory
```

---

## 1. JDK 17 运行环境安装

```bash
# Ubuntu 安装 OpenJDK 17
sudo apt install -y openjdk-17-jdk

# CentOS（先启用模块流）
# sudo dnf install -y java-17-openjdk-devel

# 验证
java -version          # 期望输出 17.x
which java             # /usr/lib/jvm/.../bin/java

# 配置 JAVA_HOME（写入环境变量，永久生效）
echo 'export JAVA_HOME=$(dirname $(dirname $(readlink -f $(which java))))' | sudo tee -a /etc/profile.d/java.sh
echo 'export PATH=$JAVA_HOME/bin:$PATH' | sudo tee -a /etc/profile.d/java.sh
source /etc/profile.d/java.sh
echo $JAVA_HOME        # 确认非空
```

---

## 2. MySQL 8.0 安装 + 远程授权 + 防火墙

### 2.1 安装与初始化

```bash
# Ubuntu
sudo apt install -y mysql-server
sudo systemctl enable --now mysql

# CentOS
# sudo dnf install -y mysql-server
# sudo systemctl enable --now mysqld

# 安全初始化（按提示设 root 密码、禁止远程 root 登录等）
sudo mysql_secure_installation
```

### 2.2 建库建表与远程授权

```bash
sudo mysql -u root -p
```

```sql
-- 创建业务库
CREATE DATABASE IF NOT EXISTS inventory DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- 创建业务账号，允许任意主机远程连接（% 表示全部；如仅本机可改 'localhost'）
CREATE USER IF NOT EXISTS 'inv_user'@'%' IDENTIFIED WITH mysql_native_password BY 'Inv@Passw0rd2026!';
GRANT ALL PRIVILEGES ON inventory.* TO 'inv_user'@'%';
FLUSH PRIVILEGES;

-- 执行建表 SQL（已在 inventory_schema_v1.sql）
-- USE inventory; SOURCE /opt/inventory/inventory_schema_v1.sql;
EXIT;
```

### 2.3 允许 MySQL 监听远程（改 bind-address）

```bash
# Ubuntu 配置文件路径
sudo sed -i "s/^bind-address.*/bind-address = 0.0.0.0/" /etc/mysql/mysql.conf.d/mysqld.cnf
# CentOS: sudo sed -i "s/^bind-address.*/bind-address = 0.0.0.0/" /etc/my.cnf.d/mysql-server.cnf

sudo systemctl restart mysql
sudo ss -tlnp | grep 3306        # 确认监听 0.0.0.0:3306
```

### 2.4 防火墙 / 安全组开放端口

```bash
# Ubuntu (ufw)
sudo ufw allow 22/tcp      # SSH，务必先开
sudo ufw allow 3306/tcp    # MySQL 远程（如仅本机 Nginx 连库可不开）
sudo ufw allow 80/tcp      # HTTP
sudo ufw allow 443/tcp     # HTTPS
sudo ufw enable
sudo ufw status

# CentOS (firewalld)
# sudo firewall-cmd --permanent --add-port={22,80,443,3306}/tcp
# sudo firewall-cmd --reload
```

> ⚠️ **云厂商安全组**：必须在阿里云/腾讯云控制台的「安全组」里同样放行 80/443/3306（3306 建议仅对应用服务器私网 IP 开放，不要对公网 0.0.0.0 开放）。

---

## 3. 上传 jar 包 + 后台运行 + 日志查看

### 3.1 上传（本地终端执行，非服务器）

```bash
# 从开发机把 jar 传到服务器 /opt/inventory
scp /本地路径/inventory.jar user@服务器IP:/opt/inventory/

# 若服务器已装 lrzsz，也可登录后用 rz 上传
# sudo apt install -y lrzsz && rz
```

### 3.2 生产配置文件（application-prod.yml 示例）

```yaml
server:
  port: 8080
spring:
  datasource:
    url: jdbc:mysql://127.0.0.1:3306/inventory?useUnicode=true&characterEncoding=utf8mb4&serverTimezone=Asia/Shanghai
    username: inv_user
    password: Inv@Passw0rd2026!
    driver-class-name: com.mysql.cj.jdbc.Driver
jwt:
  secret: 换成一段足够长的随机字符串(>=32位)
  expire-hours: 72
```

### 3.3 后台启动（方式一：nohup，最简单）

```bash
cd /opt/inventory
# 启动并将输出写入 app.log
nohup java -jar inventory.jar --spring.profiles.active=prod > app.log 2>&1 &

# 确认进程与端口
sleep 5
ps -ef | grep inventory.jar | grep -v grep
curl -s http://localhost:8080/api/dashboard | head -c 200   # 看是否返回 JSON
```

### 3.4 后台启动（方式二：systemd，推荐生产）

```bash
sudo tee /etc/systemd/system/inventory.service > /dev/null <<'EOF'
[Unit]
Description=Inventory SpringBoot Service
After=network.target mysql.service

[Service]
User=$USER
WorkingDirectory=/opt/inventory
ExecStart=/usr/lib/jvm/java-17-openjdk-amd64/bin/java -jar /opt/inventory/inventory.jar --spring.profiles.active=prod
SuccessExitStatus=143
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now inventory
sudo systemctl status inventory --no-pager
```

### 3.5 日志查看

```bash
# nohup 方式
tail -f /opt/inventory/app.log        # 实时跟踪
grep ERROR /opt/inventory/app.log     # 查错误

# systemd 方式
sudo journalctl -u inventory -f       # 实时
sudo journalctl -u inventory --since "2026-08-14 00:00" -n 200
```

### 3.6 常用运维命令

```bash
# 停止 / 重启
sudo systemctl stop inventory
sudo systemctl restart inventory

# 更新上线（nohup 方式）
pkill -f inventory.jar && sleep 2
nohup java -jar inventory.jar --spring.profiles.active=prod > app.log 2>&1 &
```

---

## 4. Nginx 反向代理 + HTTPS 证书

### 4.1 安装 Nginx

```bash
sudo apt install -y nginx             # CentOS: sudo dnf install -y nginx
sudo systemctl enable --now nginx
```

### 4.2 站点配置（HTTP 先通，再签发证书）

```bash
sudo tee /etc/nginx/sites-available/inventory > /dev/null <<'EOF'
server {
    listen 80;
    server_name yourdomain.com;        # 改成你的域名

    location / {
        proxy_pass http://127.0.0.1:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF
sudo ln -sf /etc/nginx/sites-available/inventory /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### 4.3 一键签发 HTTPS 证书（Let's Encrypt，免费）

```bash
# 安装 certbot（含 Nginx 插件）
sudo apt install -y certbot python3-certbot-nginx   # CentOS: sudo dnf install -y certbot python3-certbot-nginx

# 自动申请证书并改写 Nginx 配置（按提示填邮箱、同意条款）
sudo certbot --nginx -d yourdomain.com

# 验证自动续期
sudo certbot renew --dry-run
```

签发后访问 `https://yourdomain.com/api/dashboard` 即为加密连接。证书 90 天自动续期（系统定时器默认开启）。

> 若暂未备案/无域名：可先用自签证书做内网测试
> ```bash
> sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
>   -keyout /etc/nginx/selfsigned.key -out /etc/nginx/selfsigned.crt
> # 并在 Nginx 配置 listen 443 ssl; ssl_certificate /etc/nginx/selfsigned.crt; ssl_certificate_key /etc/nginx/selfsigned.key;
> ```

---

## 5. 域名备案流程（中国内地服务器必做）

> 备案是**管局行政流程**，无命令行可跑，全部在云厂商控制台完成。

1. **购买域名**：在阿里云/腾讯云等注册（需实名认证）。
2. **提交备案**：进入对应云厂商「ICP 备案」控制台，按向导填主体信息、网站信息、服务器 IP。
3. **管局审核**：通常 1~20 个工作日，短信核验。
4. **备案号悬挂**：审核通过后，在网站底部加 `沪ICP备XXXXXXXX号-X` 字样。
5. **解析域名**：备案完成后，在 DNS 解析把 `yourdomain.com` → 服务器公网 IP。
6. 之后才能用 80/443 对外提供公网 HTTP/HTTPS 服务（未备案域名解析到大陆服务器会被阻断）。

> 仅内网/公网 IP 直连测试可跳过备案；但正式对外必须用已备案域名。

---

## 6. 上线自检清单（复制执行）

```bash
echo "== 进程 ==" && systemctl is-active inventory
echo "== 端口 ==" && ss -tlnp | grep -E ':(8080|80|443|3306)'
echo "== 接口 ==" && curl -s -o /dev/null -w "dashboard HTTP %{http_code}\n" https://yourdomain.com/api/dashboard
echo "== 数据库 ==" && sudo mysql -u inv_user -p'Inv@Passw0rd2026!' -e "USE inventory; SHOW TABLES;"
echo "== 磁盘 ==" && df -h /opt && echo "== 内存 ==" && free -h
```

---

## 7. 常见故障速查

| 现象 | 排查命令 | 常见原因 |
|---|---|---|
| 启动即退 | `journalctl -u inventory -n 50` | MySQL 连不上 / 配置路径错 |
| 接口 404 | `curl localhost:8080/api/dashboard` | context-path 或端口不一致 |
| 远程连不上 MySQL | `sudo ss -tlnp\|grep 3306` + 云安全组 | bind 未改 / 安全组未放行 |
| HTTPS 不生效 | `sudo nginx -t` + `certbot certificates` | 域名未解析 / 80 端口未通 |
| 上传 jar 后无反应 | `ls -l /opt/inventory` + `java -jar` 前台试跑 | 包损坏 / 缺 prod 配置 |

# 使用官方 Node.js 镜像作为基础镜像
FROM node:18-slim AS build

# 设置工作目录
WORKDIR /app

# 复制 package.json 和 yarn.lock
COPY package.json yarn.lock ./

# 安装依赖
RUN yarn install

# 复制项目文件
COPY . .

# 构建项目
RUN yarn build

# 暴露应用运行的端口
EXPOSE 8080

# 启动命令，可以通过环境变量来控制
CMD ["yarn", "start"]
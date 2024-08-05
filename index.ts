import { Client } from 'minio';
import cors from "cors";
import express from "express";
import { nanoid } from "nanoid";
import favicon from "serve-favicon";
import * as path from "path";
import { config } from 'dotenv';
config();

const BUCKET_NAME = "excalidraw-json";

const FILE_SIZE_LIMIT = 2 * 1024 * 1024;
const isDevMode = process.env.IS_DEV_MODE === 'true';


// 初始化 MinIO 客户端
const minioClient = new Client({
  endPoint: process.env.MINIO_ENDPOINT!,
  port: parseInt(process.env.MINIO_PORT!, 10),
  useSSL: process.env.MINIO_USE_SSL === 'true',
  accessKey: process.env.MINIO_ACCESS_KEY!,
  secretKey: process.env.MINIO_SECRET_KEY!
});

const app = express();

let allowOrigins = [
  "https://heshe.tech",
  "https://draw.heshe.tech",
];
if (isDevMode) {
  allowOrigins.push("http://localhost:");
}

const corsGet = cors();
const corsPost = cors((req, callback) => {
  const origin = req.headers.origin;
  let isGood = false;
  if (origin) {
    for (const allowOrigin of allowOrigins) {
      if (origin.indexOf(allowOrigin) >= 0) {
        isGood = true;
        break;
      }
    }
  }
  callback(null, { origin: isGood });
});

app.use(favicon(path.join(__dirname, "favicon.ico")));
app.get("/", (req, res) => res.sendFile(`${process.cwd()}/index.html`));

app.get("/api/v2/:key", corsGet, async (req, res) => {
  try {
    const key = req.params.key;
    const stream = await minioClient.getObject(BUCKET_NAME, key);
    res.status(200);
    res.setHeader("content-type", "application/octet-stream");
    stream.pipe(res);
  } catch (error) {
    console.error(error);
    res.status(404).json({ message: "Could not find the file." });
  }
});

app.post("/api/v2/post/", corsPost, (req, res) => {
  try {
    let fileSize = 0;
    const id = nanoid();
    const data: Buffer[] = []; // 显式声明类型为 Buffer 数组

    req.on("data", (chunk: Buffer) => {
      data.push(chunk);
      fileSize += chunk.length;
      if (fileSize > FILE_SIZE_LIMIT) {
        const error = {
          message: "Data is too large.",
          max_limit: FILE_SIZE_LIMIT,
        };
        console.error(error);
        return res.status(413).json(error);
      }
    });

    req.on("end", async () => {
      const buffer = Buffer.concat(data);
      try {
        await minioClient.putObject(BUCKET_NAME, id, buffer,fileSize, {
          "Content-Type": "application/octet-stream",
        });
        res.status(200).json({
          id,
          data: `${isDevMode ? "http" : "https"}://${req.get("host")}/api/v2/${id}`,
        });
      } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Could not upload the data." });
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Could not upload the data." });
  }
});

const port = process.env.PORT || 8080;
app.listen(port, () => console.log(`http://localhost:${port}`));

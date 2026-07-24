import http from "http";
import fs from "node:fs";
import path from "node:path";

const BASE = "http://127.0.0.1:3000";

function request(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {},
    };
    const req = http.request(options, (res) => {
      const chunks = [];
      res.on("data", (d) => chunks.push(d));
      res.on("end", () => {
        let json = null;
        try { json = JSON.parse(Buffer.concat(chunks).toString()); } catch {}
        resolve({ status: res.statusCode, headers: res.headers, body: json });
      });
    });
    req.on("error", reject);
    if (body && typeof body.pipe === "function") {
      body.pipe(req);
    } else if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function multipartUpload(urlPath, fields, files) {
  const boundary = "----FormBoundary" + Math.random().toString(36).slice(2);
  const parts = [];

  for (const [key, value] of Object.entries(fields)) {
    parts.push(
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`)
    );
  }

  for (const file of files) {
    const content = fs.readFileSync(file.path);
    const mime = file.mime || "image/jpeg";
    parts.push(
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${file.field}"; filename="${file.name}"\r\nContent-Type: ${mime}\r\n\r\n`)
    );
    parts.push(content);
    parts.push(Buffer.from("\r\n"));
  }

  parts.push(Buffer.from(`--${boundary}--\r\n`));
  const body = Buffer.concat(parts);

  return new Promise((resolve, reject) => {
    const url = new URL(urlPath, BASE);
    const options = {
      method: "POST",
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
        "Content-Length": String(body.length),
      },
    };
    const req = http.request(options, (res) => {
      const chunks = [];
      res.on("data", (d) => chunks.push(d));
      res.on("end", () => {
        const raw = Buffer.concat(chunks).toString();
        let json = null;
        try { json = JSON.parse(raw); } catch {}
        resolve({ status: res.statusCode, raw, body: json });
      });
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  const dummy = path.join("test-media", "test_pattern.mp4");

  // 1. duplicate check via body name
  const dupCheck = await request("GET", "/api/persons/check_duplicate?name=Терешин%20Александр%20Николаевич");
  console.log("check_duplicate:", JSON.stringify(dupCheck.body));

  // 2. create person with normalized name from file
  const create1 = await multipartUpload("/api/persons", { category: "CLIENT" }, [
    { field: "photos", name: "петров петр петрович-начальник.mp4", path: dummy },
  ]);
  console.log("create1 status:", create1.status, "name:", create1.body?.name, "position:", create1.body?.position);

  // 3. try create same person again -> should be 409
  const create2 = await multipartUpload("/api/persons", { category: "CLIENT" }, [
    { field: "photos", name: "Петров Петр Петрович-Начальник.mp4", path: dummy },
  ]);
  console.log("create2 status:", create2.status, "detail:", create2.body?.detail);

  // 4. test double encoded cyrillic
  const bad = Buffer.from("ÐŸÐµÑ‚Ñ€Ð¾Ð² ÐŸÐµÑ‚Ñ€ ÐŸÐµÑ‚Ñ€Ð¾Ð²Ð¸Ñ‡").toString("latin1");
  const create3 = await multipartUpload("/api/persons", { name: bad, category: "CLIENT" }, []);
  console.log("create3 status:", create3.status, "name:", create3.body?.name);

  // 5. bulk import with mixed casing and duplicates
  const bulk = await multipartUpload("/api/persons/bulk_import", { category: "CLIENT" }, [
    { field: "files", name: "Сидоров сидор-Менеджер.mp4", path: dummy },
    { field: "files", name: "СИДОРОВ СИДОР-МЕНЕДЖЕР.mp4", path: dummy },
  ]);
  const bulkJob = bulk.body;
  console.log("bulk import status:", bulk.status, "job_id:", bulkJob?.job_id);

  if (bulkJob?.job_id) {
    for (let i = 0; i < 10; i++) {
      await new Promise((r) => setTimeout(r, 500));
      const status = await request("GET", `/api/persons/bulk_import/${bulkJob.job_id}`);
      if (status.body?.status === "done") {
        console.log("bulk done:", JSON.stringify(status.body));
        break;
      }
    }
  }

  console.log("TEST_COMPLETE");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

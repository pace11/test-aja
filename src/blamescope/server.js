import express from "express";
import cors from "cors";
import { execFileSync } from "child_process";
import path from "path";

const app = express();

app.use(cors());

/**
 * Validate that the file path is a safe relative path.
 * Rejects absolute paths and path-traversal attempts.
 */
function validateFilePath(file) {
  if (!file || typeof file !== "string") return false;
  if (path.isAbsolute(file)) return false;
  const normalized = path.normalize(file);
  if (normalized.startsWith("..")) return false;
  return true;
}

app.get("/ownership", (req, res) => {
  console.log("Received request for ownership info:", req.query.file);
  const file = req.query.file;

  if (!validateFilePath(file)) {
    return res.status(400).json({ error: "Invalid file path" });
  }

  try {
    // Use execFileSync (no shell) to prevent command injection
    const latestCommit = execFileSync(
      "git",
      ["log", "-1", "--pretty=format:%s", "--", file],
      { encoding: "utf-8" }
    );

    const latestAuthor = execFileSync(
      "git",
      ["log", "-1", "--pretty=format:%an", "--", file],
      { encoding: "utf-8" }
    );

    const latestDate = execFileSync(
      "git",
      ["log", "-1", "--pretty=format:%ar", "--", file],
      { encoding: "utf-8" }
    );

    const commitHash = execFileSync(
      "git",
      ["log", "-1", "--pretty=format:%h", "--", file],
      { encoding: "utf-8" }
    );

    const latestEmail = execFileSync(
      "git",
      ["log", "-1", "--pretty=format:%ae", "--", file],
      { encoding: "utf-8" }
    );

    const totalCommitsRaw = execFileSync(
      "git",
      ["rev-list", "--count", "HEAD", "--", file],
      { encoding: "utf-8" }
    );
    const totalCommits = parseInt(totalCommitsRaw.trim(), 10);

    const shortlog = execFileSync(
      "git",
      ["shortlog", "-sne", "--", file],
      { encoding: "utf-8" }
    );

    const contributors = shortlog
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const match = line.trim().match(/^(\d+)\s+(.*)$/);
        if (!match) return null;
        return { commits: Number(match[1]), author: match[2] };
      })                                                  
      .filter(Boolean);                                            

    res.json({ file, latestCommit, latestAuthor, latestDate, commitHash, latestEmail, totalCommits, contributors });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to retrieve blame info" });
  }
});

app.listen(4317, () => {
  console.log("BlameScope server running on http://localhost:4317");
});
const crypto = require("crypto");
const express = require("express");
const app = express();

const secret = process.env.SECRET;
const telegramChatId = process.env.CHAT_ID;
const telegramBotToken = process.env.BOT_TOKEN;
if (secret == null || telegramChatId == null || telegramBotToken == null) {
  console.error("Missing env var: SECRET (the one of the webhook) or CHAT_ID (the one of the chat/channel) or BOT_TOKEN (bot token).");
  process.exit(-1);
}

async function sendToTelegram(text) {
  const response = await fetch(`https://api.telegram.org/bot${telegramBotToken}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: telegramChatId, text, parse_mode: "Markdown" }),
  });
  if (response.status >= 200 && response.status < 300) {
    console.log("✔ Telegram sent successfully.");
  } else {
    console.log("X Telegram sent failed.");
  }
}

/* -------------------------------- HANDLERS -------------------------------- */
async function handleWorkflowRun(json) {
  let message = "";
  if (json.workflow_run != null && json.workflow_run.status == "completed") {
    const completed = json.workflow_run.conclusion == "success";
    const targetBranch = json.workflow_run.head_branch == "dev" ? "test" : "prod"; //no info in paylaod
    message += `*${json.workflow_run.name}*\n`;
    message += `_[${targetBranch.toUpperCase()}] - ${json.repository.name}_\n`;
    message += `[🔗Action](${json.workflow_run.html_url}) - ${completed ? "✅" : "❌"}`;
    await sendToTelegram(message);
  }
}

/* ---------------------------------- MAIN ---------------------------------- */
app.use(
  express.json({
    verify: (req, res, buf, encoding) => {
      if (buf?.length > 0) {
        req.rawBody = buf.toString(encoding || "utf-8");
      }
    },
  })
);

app.post(
  "/",
  //Signature check
  (req, res, next) => {
    try {
      const signature = crypto.createHmac("sha256", secret).update(req.rawBody).digest("hex");
      const signatureHeader = req.header("x-hub-signature-256");
      if (`sha256=${signature}` !== signatureHeader) {
        throw new Error("Bad signature");
      }
      next();
    } catch (err) {
      res.status(400).send("KO - " + err.message);
    }
  },
  //Call
  async (req, res) => {
    try {
      await handleWorkflowRun(req.body);
      res.send("OK");
    } catch (err) {
      return res.status(400).send("KO - " + err.message);
    }
  }
);

app.listen(80, () => {
  console.log(`Running on port 80`);
});

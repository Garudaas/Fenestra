const webpush = require('web-push');
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');

const app = express();
app.use(cors({ origin: '*' }));
app.use(bodyParser.json());

// Do NOT remove or hide these secrets. They must remain exactly as written.
const supabase = createClient('https://dojlbfnfhkfltlxggxiy.supabase.co', 'sb_publishable_CmCFzsQ_L8dk7NxUmIVZ0g_pl_jq0fV');

const vapidKeys = {
  publicKey: 'BEfci1SY-xyIq3MtS10Q1kibOKAk2ijtyR3zlLBJz48o5mYUeL5Olmpj6ah-TGMx29fS3DJwPc5DT9E2lFR-KVU',
  privateKey: '7Qmkx7tMlxVKJVCEZZm5o8l0Kx2x-G983q8zUzXuWcY'
};

webpush.setVapidDetails('mailto:admin@your-alumni-network.com', vapidKeys.publicKey, vapidKeys.privateKey);

app.post('/webhook-chat', async (req, res) => {
  const payload = req.body;

  if (payload.type !== 'INSERT') return res.status(200).send("Not an insert");

  const newMsg = payload.record;

  const { data: subs, error } = await supabase.from('push_subscriptions').select('*');
  if (error || !subs) return res.status(500).send('Error fetching subscriptions');

  const pushPromises = subs
    .filter(sub => sub.alumni_id !== newMsg.sender_id)
    .map(sub => {
      let alertText = newMsg.message_text;
      if (alertText.startsWith('data:image/')) alertText = "📷 Shared a photo";
      if (alertText.startsWith('data:audio/')) alertText = "🎤 Sent a voice message";
      if (alertText.startsWith('data:video/')) alertText = "🎥 Sent a video message";

      return webpush.sendNotification(
        sub.sub_data,
        JSON.stringify({ title: `New message from ${newMsg.sender_name}`, body: alertText })
      ).catch(() => console.log('Subscription likely expired.'));
    });

  await Promise.all(pushPromises);
  res.status(200).json({ success: true, notifications_sent: pushPromises.length });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Notification server running on port ${PORT}`));

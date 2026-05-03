// FAQ content for /faq. Three sections, accordion'd on the page itself.
// Adapted from esimwander.com/faq with Nimvoy rebranding + warmer tone.
//
// To add a new question: drop a {q, a} into the right section. To add a
// new section: append to FAQ_SECTIONS. The page renders sections in order
// and uses the section ID as the anchor (so /faq#install works).

export interface FaqItem {
  q: string
  a: string
}

export interface FaqSection {
  id: string
  title: string
  intro?: string
  items: FaqItem[]
}

export const FAQ_SECTIONS: FaqSection[] = [
  {
    id: 'before',
    title: 'Before you buy',
    intro: 'The basics — what an eSIM is, whether your phone supports it, and how Nimvoy plans behave.',
    items: [
      {
        q: 'What is an eSIM?',
        a: "An eSIM is a digital SIM card built into your phone — no plastic chip to swap. With Nimvoy you stay connected wherever you land without changing physical SIMs or hunting for a kiosk at the airport.",
      },
      {
        q: 'Is my phone compatible?',
        a: "Most modern phones are. iPhones from the XR onwards (iPhone XR, XS, 11, 12, 13, 14, 15, 16, and SE 2020+), Google Pixel 3+, and a wide range of recent Samsung Galaxy models all support eSIMs. If you bought your phone in the last 4–5 years from a major carrier, it almost certainly works. When in doubt, check Settings → Cellular / Mobile Network — if you see an \"Add eSIM\" option, you're good.",
      },
      {
        q: 'When will I get my QR code after I purchase?',
        a: "Right after you click Pay. We send your activation email — with the one-tap install link and a backup QR code — within about 60 seconds. You can install it before you leave home so it's ready to go the moment you land.",
      },
      {
        q: 'Can I use my regular SIM and the Nimvoy eSIM at the same time?',
        a: "Yes. Almost every eSIM-capable phone supports dual-SIM, so you can keep your home number active for calls and SMS and use the Nimvoy eSIM for data. Most people set the eSIM as the data line and leave their home number as the voice line — no missed calls, no roaming charges.",
      },
      {
        q: 'Does the eSIM support hotspot tethering?',
        a: "Yes. Personal Hotspot / Wi-Fi tethering works the same as on your home plan. Bring a tablet, laptop, or travel buddy along — they can share your Nimvoy data without buying their own eSIM.",
      },
      {
        q: 'Can I make phone calls or send SMS?',
        a: "Nimvoy plans are data-only — no local phone number is provisioned. But you can call, video call, and message over WhatsApp, iMessage, FaceTime, Signal, Zoom, or any other app that runs on data. For most travelers, that covers everything they actually need.",
      },
      {
        q: 'Which carrier will I connect to?',
        a: "Nimvoy partners with the strongest local network in each destination — NTT Docomo and SoftBank in Japan, SK Telecom and KT in Korea, T-Mobile and AT&T in the US, China Mobile in China, and the major carriers across Europe and Asia-Pacific. The eSIM connects automatically; you don't pick the carrier manually.",
      },
      {
        q: 'Can I use TikTok, ChatGPT, Instagram, or other apps?',
        a: "Yes — Nimvoy is regular internet data, just delivered over a local carrier. Anything you'd do on Wi-Fi at home works the same on a Nimvoy eSIM, including streaming, social apps, AI chat, and video calls.",
      },
    ],
  },
  {
    id: 'install',
    title: 'Installing & using your eSIM',
    intro: 'How to install before you fly and what to expect once you land.',
    items: [
      {
        q: 'How do I install my Nimvoy eSIM?',
        a: "Easiest way: open the activation email on the phone you'll use and tap the one-tap install button (works on iOS 17.4+ and Android 10+). The Add eSIM screen pops up with everything pre-filled — confirm and you're done. If your phone doesn't support one-tap, scan the QR code in the email instead: open your camera or go to Settings → Cellular → Add eSIM, point at the QR, follow the prompts. Takes under a minute.",
      },
      {
        q: 'When should I install — before I leave or after I land?',
        a: "Install before you leave, while you're still on home Wi-Fi. The eSIM doesn't activate until it connects to a local network at your destination, so installing early doesn't burn any of your plan's days — but it means you walk off the plane already configured. No frantic airport Wi-Fi, no scrambling for a hotspot.",
      },
      {
        q: 'Do I need to turn on data roaming?',
        a: "Yes — for the Nimvoy line specifically. Once you've installed the eSIM, go to Settings → Cellular → Nimvoy line → enable Data Roaming. This tells your phone it's allowed to use a foreign network. Your home line's roaming setting can stay off (so you don't accidentally rack up charges from your home carrier).",
      },
      {
        q: 'When does my plan start counting down?',
        a: "The day-count begins when the eSIM first connects to a local network at your destination — not when you bought it, and not when you installed it. So you can buy a 30-day Japan plan a week before your trip and still get the full 30 days starting the moment you land.",
      },
      {
        q: 'How can I check how much data I have left?',
        a: "On iPhone: Settings → Cellular → scroll to the Nimvoy line. On Android: Settings → Network & Internet → Mobile Network → Nimvoy line. The current period's usage is shown there. We're also working on a usage view in your Nimvoy account — coming soon.",
      },
      {
        q: 'What happens when my data or days run out?',
        a: "The eSIM stops carrying traffic — no surprise overage charges. You can buy a new plan from any browser; it'll add to the same line on your phone (no need to install a new eSIM unless your old plan has fully expired and been removed). If you're mid-trip, plan top-ups land in your inbox in the same 60-second window.",
      },
      {
        q: 'Could my speeds get throttled?',
        a: "Rarely. A few carriers reduce speeds for very heavy users on consumer plans during peak congestion, but for typical travel use — maps, messaging, social, video calls, occasional streaming — you'll get full local 4G/5G speeds.",
      },
      {
        q: 'Should I delete the eSIM after my trip?',
        a: "Not necessary. Once your plan expires the line goes dormant; it doesn't consume battery or data. You can leave it installed for the next trip (we'll just send a fresh activation email), or delete it any time from Settings → Cellular → Nimvoy line → Remove eSIM.",
      },
    ],
  },
  {
    id: 'support',
    title: 'Help & support',
    intro: "If something's not working, start here. If your question isn't covered, email us — we usually reply within a few hours.",
    items: [
      {
        q: 'I lost or deleted my QR code. What should I do?',
        a: "Email support@nimvoy.com with your order reference (looks like ESIM-A3X9K2 — it's in the original confirmation email's subject line). We'll resend the activation email with your QR code and one-tap install link.",
      },
      {
        q: 'My eSIM isn\'t connecting at my destination — what should I check?',
        a: "Three quick checks: (1) Data Roaming is enabled on the Nimvoy line in Settings. (2) The Nimvoy line is selected as your data line, not just installed. (3) Try toggling Airplane Mode on and off, which forces the phone to re-scan for networks. If none of that works, email support@nimvoy.com — include your order reference and a screenshot of your cellular settings, and we'll get you online.",
      },
      {
        q: 'Can I get a refund?',
        a: "Yes, in three cases: (1) your phone turns out to be incompatible, (2) your trip cancels and you haven't used the eSIM, (3) we can't get you connected and the issue is on our end. Email us within 30 days of purchase. Refunds go back to your original card and typically show up in 5–10 business days.",
      },
      {
        q: 'Can I share my plan with someone else?',
        a: "An eSIM is tied to one device, so you can't directly transfer it. But personal hotspot / tethering is supported — your travel partner can connect their phone or laptop to your Nimvoy data via your phone's hotspot.",
      },
      {
        q: 'Do you offer top-ups while I\'m traveling?',
        a: "Yes. Buy a new plan for the same destination from your account page or our website. It auto-applies to the same eSIM line on your phone — no reinstall, no second QR.",
      },
      {
        q: 'How do I contact support?',
        a: "Email support@nimvoy.com any time. We aim to reply within a few hours during business hours, and within a day on weekends. Please include your order reference (ESIM-XXXXXX) so we can look up your details immediately.",
      },
    ],
  },
]

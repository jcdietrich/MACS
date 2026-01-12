# M.A.C.S. - Mood-Aware Character SVG

M.A.C.S. is a playful, expressive, animated companion for Home Assistant.

It visualises Assist interactions and broader system context using a living SVG character.

Rather than showing buttons and graphs, MACS shows state, mood, and intent, giving your smart home a friendly, readable presence.

![Screenshot of Macs in Home Assistant Dashboard](https://github.com/glyndavidson/MACS/blob/main/resources/screenshot.png)
<br><br>


## Buy me a Coffee
If you find Macs useful, please consider [buying me a coffee](https://buymeacoffee.com/glyndavidson) to encourage continued development.<br>

[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-%F0%9F%8D%BA-yellow)](https://buymeacoffee.com/glyndavidson)
<br><br>


## What MACS Does
Originally, I developed Macs because I wasn't sure if my Wake Words were triggering and if Home Assistant was listening to, and understanding my requests. I wanted some feedback so that I could see what was happening. Since fixing this problem, Macs has grown into more than just a friendly assistant - he now pulls data from multiplke sensors and can visualise things like weather forecasts, battery charging, etc.


## Design Philosophy
MACS is not a control panel.

It is:
- A companion
- A status glance
- A playful way to visualise the state of various home assistant entities.

![Concept sketches for Macs](https://github.com/glyndavidson/MACS/blob/main/resources/art-philosophy.png?raw=true)

Perfect for:
- Wall tablets
- Old iPads
- Kiosk dashboards
<br><br>


## Installation
- Install the Macs Card via Hacs.
- Create a new Dashboard with a Panel (Single Card) Layout.
- Add the Macs Card to the dashboard.
- Configure as required.
<br><br>


## Manual & Automation Control
MACS works like any other device and exposes entities and services so automations can drive its mood and effects directly.

Use macs.set_mood to change expressions. Use number entities or the matching services to control brightness, temperature, windspeed, precipitation, and battery charge. Use switches for animations_enabled, charging, and the weather_conditions_* toggles. You can also push dialogue bubbles with send_user_message and send_assistant_message.

Typical uses:
- Trigger moods from motion, presence, or security events
- Reflect weather shifts in real time
- Create time-based routines (sleeping at night, happy in the morning)

This makes MACS fully scriptable and system-driven, not just reactive to Assist.
<br><br>


## Roadmap
Macs is currently under active development.

Feedback is welcome and valuable:
- Bugs -> open an issue
- Videos/screenshots -> massively helpful
- Platform quirks -> especially tablets
<br><br>


## License
MIT License  
Fork it. Modify it. Improve it.  
Just don't be a dick.
<br><br>


## Support Macs
If you find Macs useful, please consider [buying me a coffee](https://buymeacoffee.com/glyndavidson) to support my work.<br>

[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-%F0%9F%8D%BA-yellow)](https://buymeacoffee.com/glyndavidson)
<br><br>

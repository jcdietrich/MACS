# M.A.C.S. - Mood-Aware Character SVG

M.A.C.S. is a playful, expressive, animated companion for Home Assistant.

It visualises Assist interactions and broader system context using a living SVG character.

Rather than showing buttons and graphs, MACS shows state, mood, and intent, giving your smart home a friendly, readable presence.

![Screenshot of Macs in Home Assistant Dashboard](https://github.com/glyndavidson/MACS/blob/main/resources/screenshot.png)
<br><br>


## Buy me a Coffee
If you find Macs useful, please consider [buying me a coffee](https://buymeacoffee.com/glyndavidson) to support my work.<br>

[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-%F0%9F%8D%BA-yellow)](https://buymeacoffee.com/glyndavidson)
<br><br>


## What MACS Does

MACS reacts visually to multiple layers of Home Assistant context:

### Assist Interaction
- Wake Word Trigger
- Listening
- Thinking
- Responding
- Confused / Error

### System State Awareness
- Weather conditions
- Temperature (ambient or configured sensor)
- Environmental context (e.g. hot / cold / windy / rain)

### Event-Driven Reactions
- Motion detection
- Presence changes
- Custom HA events
- Automation triggers

All of this is expressed through:
- Mood
- Facial expression
- Animation
- Subtle visual cues (eyes, posture, motion)
<br><br>


## Design Philosophy
MACS is not a control panel.

It is:
- A companion
- A status glance
- A confidence signal that your home heard you and is doing something

![Concept sketches for Macs](https://github.com/glyndavidson/MACS/blob/main/resources/art-philosophy.png?raw=true)

Perfect for:
- Wall tablets
- Old iPads
- Kiosk dashboards
- Ambient displays
<br><br>


## Manual & Automation Control
MACS exposes a custom service: macs.set_mood

This allows any Home Assistant automation to directly control MACS's mood.

You can trigger mood changes based on:
- Motion detection
- Presence
- Weather changes
- Time of day
- Security events
- Any HA state, event, or condition

This makes MACS fully scriptable and system-driven, not just reactive to Assist.
<br><br>


## Installation
- Install the Macs Card.
- Obtain the Assistant Pipeline ID.
- Add the ID to the Macs Card.
- (HACS instructions coming once published.)


### Add to a Dashboard
Add the MACS card and configure:
- Assist pipeline ID

The card automatically sends:
- Assist state
- System context
- Event triggers  
to the display.
<br><br>


## Roadmap
Macs is very much in Beta stage and as of December 29th, 2025, is under heavy development.

Feedback is welcome and valuable:
- Bugs -> open an issue
- Videos/screenshots -> massively helpful
- Platform quirks -> especially tablets

This project is evolving by use, not speculation.
<br><br>


## License
MIT License  
Fork it. Modify it. Improve it.  
Just don't be a dick.
<br><br>


## Buy me a Coffee
If you find Macs useful, please consider [buying me a coffee](https://buymeacoffee.com/glyndavidson) to support my work.<br>

[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-%F0%9F%8D%BA-yellow)](https://buymeacoffee.com/glyndavidson)
<br><br>

---
sidebar_position: 1
slug: /
title: Welcome
---

# AEMTemplate

AEMTemplate is the robot code library used by FRC Team 6443, AEMBOT. It sits on top of WPILib, AdvantageKit, and CTRE Phoenix 6, and provides the pieces that stay the same from season to season: motor and sensor wrappers, configurable subsystems, simulation, logging, and a robot state model.

The code is split into two packages:

- `com.aembot.lib` holds everything that is meant to be reused. Nothing in here should reference a specific game or robot.
- `com.aembot.frcXXXX` holds the season code, where `XXXX` is the year of the current game (for example `com.aembot.frc2026`). This is where robots are described, subsystems are wired together, and commands are written. This package is replaced each season, and the library is not.

## Where to go

The documentation is organized into two sections.

**Tutorials** walk through common tasks from start to finish. Start here if you are setting up a new robot or adding a mechanism for the first time.

**Reference** describes each part of the library on its own. Use it when you already know what class you need and want to see what it does and how to configure it.

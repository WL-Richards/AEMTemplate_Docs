---
sidebar_position: 4
title: Useful Links
---

# Useful Links

Documentation for the libraries and tools this codebase depends on, grouped by what they are used for.

## Team

| Link                                           | What it is                                                      |
| ---------------------------------------------- | --------------------------------------------------------------- |
| [AEMBOT on GitHub](https://github.com/AEMBOT)  | Team organization. Robot code for every season lives here.      |
| [FRC_2026](https://github.com/AEMBOT/FRC_2026) | The 2026 season repo. Most tutorial examples are drawn from it. |

## Core frameworks

| Link                                                   | What it is                                                        |
| ------------------------------------------------------ | ----------------------------------------------------------------- |
| [WPILib Docs](https://docs.wpilib.org)                 | The base framework. Command-based, hardware APIs, and simulation. |
| [AdvantageKit Docs](https://docs.advantagekit.org)     | Logging and replay framework the IO layer pattern comes from.     |
| [AdvantageScope Docs](https://docs.advantagescope.org) | Log viewer. Used for reviewing matches and tuning.                |

## Hardware

| Link                                                  | What it is                                                      |
| ----------------------------------------------------- | --------------------------------------------------------------- |
| [Phoenix 6 Docs](https://v6.docs.ctr-electronics.com) | CTRE motor controllers, CANcoders, Pigeon, and CANivore.        |
| [Limelight Docs](https://docs.limelightvision.io)     | AprilTag camera used by the vision subsystem on the real robot. |

## Autonomous

| Link                                        | What it is                                                                                     |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| [Choreo Docs](https://choreo.autos)         | Trajectory generator and follower. Autos are built with its `AutoFactory`.                     |
| [PathPlanner Docs](https://pathplanner.dev) | Only its config classes (`RobotConfig`, `PIDConstants`) are used. Autos do not run through it. |

## Simulation

| Link                                                                 | What it is                                                    |
| -------------------------------------------------------------------- | ------------------------------------------------------------- |
| [maple-sim](https://shenzhen-robotics-alliance.github.io/maple-sim/) | Physics simulation used for the drivetrain and intake in sim. |
| [PhotonVision Docs](https://docs.photonvision.org)                   | Camera simulation used by the vision subsystem in sim.        |

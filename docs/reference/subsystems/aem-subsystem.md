---
sidebar_position: 1
title: AEMSubsystem
---

# AEMSubsystem

`AEMSubsystem` is the root of every subsystem in the library. It extends WPILib's `SubsystemBase`, gives the subsystem a name, and derives the two log prefixes that everything under it writes to.

```java
import com.aembot.lib.subsystems.base.AEMSubsystem;
```

It is abstract. Nothing extends it directly except `MotorSubsystem` and the handful of subsystems that are not a single motor, such as the drivetrain and vision.

## Constructor

```java
public AEMSubsystem(String name)
```

The name is stored in the public field `subsystemName` and used to build the prefixes. It is also the name the scheduler shows for the subsystem.

## Log prefixes

Two protected fields are set from the name and never change.

| Field               | Value                      | Used for                                                             |
| ------------------- | -------------------------- | -------------------------------------------------------------------- |
| `logPrefixStandard` | `Subsystems/<name>`        | Outputs the subsystem computes: setpoints, current command, latency. |
| `logPrefixInput`    | `Inputs/Subsystems/<name>` | Inputs objects, via `Logger.processInputs`.                          |

For a subsystem named `HoodSubsystem`, outputs land under `Subsystems/HoodSubsystem` and inputs under `Inputs/Subsystems/HoodSubsystem`. Subclasses append their own suffixes to these rather than building paths from scratch.

## Loggable

`AEMSubsystem` implements `Loggable`, a two method interface from `lib/core/logging`.

| Method                                                 | Description                                                                       |
| ------------------------------------------------------ | --------------------------------------------------------------------------------- |
| `updateLog()`                                          | Calls `updateLog(logPrefixStandard, logPrefixInput)`. Provided by `AEMSubsystem`. |
| `updateLog(String standardPrefix, String inputPrefix)` | Abstract. Each subclass logs its own data under the given prefixes.               |

The no-argument form is what subsystems call from `periodic()`. The two-argument form is what they override. Passing the prefixes as arguments rather than reading the fields lets a subsystem forward the call to its IO layer, which does not extend `AEMSubsystem` and has no prefixes of its own.

```java
@Override
public void updateLog(String standardPrefix, String inputPrefix) {
  io.updateLog(standardPrefix, inputPrefix); // IO logs under the same prefixes
  super.updateLog(standardPrefix, inputPrefix);
}
```

:::info
`AEMSubsystem` does not override `periodic()`. Calling `updateLog()` once per loop is the subclass's job. `MotorSubsystem` does it, so anything extending that gets it for free.
:::

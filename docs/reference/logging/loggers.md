---
sidebar_position: 1
title: Logging
---

# Logging

The logging package sets up AdvantageKit at boot and adds a throttled output logger on top of it. Three interfaces and two classes make up the whole thing.

```java
import com.aembot.lib.core.logging.AEMLogger;
import com.aembot.lib.core.logging.Loggable;
import com.aembot.lib.core.logging.Loggerable;
import com.aembot.lib.core.logging.log_entries.LogEntry;
```

For how these fit into a subsystem, see [IO Layers and Logging](../../tutorials/getting-started-frc/io-layers-and-logging).

## Loggable

`Loggable` is the interface for anything that logs under a prefix. Subsystems, IO layers, and state classes all implement it.

| Method                                                 | Description                                                              |
| ------------------------------------------------------ | ------------------------------------------------------------------------ |
| `updateLog(String standardPrefix, String inputPrefix)` | Abstract. Log this object's values under the given prefixes.             |
| `updateLog()`                                          | Default. Calls `updateLog("", "")`. Override to supply default prefixes. |

The two prefixes separate computed outputs from raw inputs. `AEMSubsystem` builds them from the subsystem name as `Subsystems/<name>` and `Inputs/Subsystems/<name>`, and `MotorSubsystem` overrides `updateLog()` to pass them in.

An implementation usually logs its own values, then calls `updateLog` on anything it owns with the same prefixes.

```java
@Override
public void updateLog(String standardPrefix, String inputPrefix) {
  io.updateLog(standardPrefix, inputPrefix); // let the IO log first
  super.updateLog(standardPrefix, inputPrefix); // then the base class
}
```

## Loggerable

`Loggerable` is the interface that configures AdvantageKit. It has no abstract methods. `RobotContainer` implements it and calls `setupLogger(robot)` once in its constructor.

| Method                           | Description                                                                            |
| -------------------------------- | -------------------------------------------------------------------------------------- |
| `setupLogger(LoggedRobot robot)` | Records metadata, adds data receivers for the current runtime mode, starts the logger. |
| `setupMetadata()`                | Records build and robot identity metadata. Called by `setupLogger`.                    |

### Data receivers

`setupLogger` switches on `RuntimeConstants.MODE` and adds a receiver for each destination.

```java
switch (MODE) {
  case REAL:
    Logger.addDataReceiver(new WPILOGWriter("/U/logs")); // USB stick on the roboRIO
    if (!DriverStation.isFMSAttached()) {
      Logger.addDataReceiver(new NT4Publisher()); // live stream, off the field only
    }
    break;
  case SIM:
    Logger.addDataReceiver(new WPILOGWriter()); // logs/ folder in the project
    Logger.addDataReceiver(new NT4Publisher());
    break;
  case REPLAY:
    robot.setUseTiming(false); // run as fast as the log can be read
    String logPath = LogFileUtil.findReplayLog();
    Logger.setReplaySource(new WPILOGReader(logPath));
    Logger.addDataReceiver(new WPILOGWriter(LogFileUtil.addPathSuffix(logPath, "_sim")));
    break;
}

Logger.start();
```

On the field, NetworkTables publishing is skipped to keep the radio link clear. In replay, outputs go to a new file next to the original with `_sim` appended, and the original is never written to.

### Metadata

`setupMetadata` records the values below. They show up under the Metadata tab in AdvantageScope.

| Key           | Source                                                                                         |
| ------------- | ---------------------------------------------------------------------------------------------- |
| `ProjectName` | `BuildConstants.MAVEN_NAME`                                                                    |
| `BuildDate`   | `BuildConstants.BUILD_DATE`                                                                    |
| `GitSHA`      | `BuildConstants.GIT_SHA`                                                                       |
| `GitDate`     | `BuildConstants.GIT_DATE`                                                                      |
| `GitBranch`   | `BuildConstants.GIT_BRANCH`                                                                    |
| `GitDirty`    | `"All changes committed"`, `"Uncommitted changes"`, or `"Unknown"` from `BuildConstants.DIRTY` |
| `RobotName`   | `RuntimeConstants.ROBOT_ID.getName()`                                                          |
| `MACAddress`  | `RuntimeConstants.ROBOT_ID.getMACAddress()`                                                    |

:::tip
`GitDirty` is the first thing to check when a log looks wrong. A log from a dirty build cannot be matched to a commit.
:::

## AEMLogger

`AEMLogger` is a static wrapper around `Logger.recordOutput` that throttles how often each key is written. Every key becomes a `LogEntry` on first use. Most outputs in the codebase go through it rather than calling AdvantageKit directly.

| Method                              | Description                                                                                     |
| ----------------------------------- | ----------------------------------------------------------------------------------------------- |
| `recordOutput(String key, T value)` | Cache a value for the key. Creates a `LogEntry` on first call. Throws if the type changes.      |
| `tick()`                            | Write every cached value whose throttle and stagger line up with this loop. Call once per loop. |
| `addEntry(LogEntry<?> entry)`       | Register an entry. Throws if the key is already registered to a different entry.                |
| `getStagger(int throttle)`          | Hand out the next stagger offset for a throttle. Used by `LogEntry`.                            |
| `keysToLogEntries`                  | Public static map of every registered entry by key.                                             |

`Robot.robotPeriodic` calls `tick()` after the scheduler runs. Nothing reaches the log until then.

```java
AEMLogger.recordOutput("Subsystems/Hood/Angle", angle); // cached now
// ...
AEMLogger.tick(); // written if this is the entry's turn
```

Throttling is disabled in replay. Every cached value is written on every tick so the replay log is complete.

:::info
A value that is recorded once and never again stays in the cache and is rewritten on its schedule forever. The log will show it as constant rather than absent.
:::

## LogEntry

`LogEntry<T>` is one throttled output key. It holds the most recent value pushed to it and knows how to hand that value to AdvantageKit for its type.

| Field       | Default                | Description                                                                      |
| ----------- | ---------------------- | -------------------------------------------------------------------------------- |
| `kKey`      | Required               | The log key.                                                                     |
| `kType`     | Required               | The value's class. Used to pick the `Logger.recordOutput` overload.              |
| `kThrottle` | `DEFAULT_THROTTLE` (5) | Write every n loops. `1` disables throttling.                                    |
| `kStagger`  | From `getStagger`      | Loop offset so entries with the same throttle do not all write on the same loop. |
| `kSupplier` | `null`                 | Optional value source. Read by `tickSupplier()`.                                 |

| Constructor                                               | Notes                             |
| --------------------------------------------------------- | --------------------------------- |
| `LogEntry(key, type)`                                     | Default throttle, no supplier.    |
| `LogEntry(key, type, int throttle)`                       | Custom throttle.                  |
| `LogEntry(key, type, Supplier<T> supplier)`               | Default throttle with a supplier. |
| `LogEntry(key, type, int throttle, Supplier<T> supplier)` | Everything.                       |

Every constructor registers the entry with `AEMLogger` and throws if the type cannot be logged.

| Method               | Description                                                                 |
| -------------------- | --------------------------------------------------------------------------- |
| `pushValue(T value)` | Cache a value and mark the entry as having new data.                        |
| `recordOutput()`     | Write the cached value to AdvantageKit.                                     |
| `hasBeenPushed()`    | Whether a value has been pushed since the last `pullValue`.                 |
| `pullValue()`        | Return the cached value and clear the pushed flag, or `null` if not pushed. |
| `peekAtValue()`      | Return the cached value without clearing anything.                          |
| `tickSupplier()`     | If a supplier is set, read it and push the result.                          |

Primitive types and their boxed forms are matched directly. Anything else is matched by reflection against the `Logger.recordOutput` overloads, preferring `StructSerializable` where a type supports both struct and protobuf.

:::info
`tickSupplier()` is not called by `AEMLogger.tick()` or anything else in the codebase. Supplier-backed entries are set up but never read from their supplier.
:::

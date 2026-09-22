---
sidebar_position: 3
title: Robot ID
---

# Robot ID

`RobotID` is the interface the library uses to ask "which robot is this?" It is implemented once per season by an enum in the season package, with one value per physical robot.

```java
import com.aembot.lib.config.RobotID;
```

The library never constructs one. It reads `RuntimeConstants.ROBOT_ID`, which the season code fills in at startup by matching the roboRIO's MAC address against a table. The [Creating a Robot Definition](../../tutorials/getting-started-aemlib/creating-a-robot-definition) tutorial walks through adding a robot to that table.

## Methods

| Method                   | Description                                                                        |
| ------------------------ | ---------------------------------------------------------------------------------- |
| `getName()`              | Human readable name for logs.                                                      |
| `getMACAddress()`        | The MAC address this ID was matched against, or `null` if it has not been set.     |
| `withMACAddress(String)` | Stores the MAC address and returns the ID. Called once by the season code at boot. |

`withMACAddress` is a builder method on an enum value, which is unusual. It exists so the ID can carry the address that was actually read off the hardware, even for the default robot that matched nothing.

## Implementing it

The season enum holds the name as a constructor argument and the MAC address in a mutable field. It also owns the lookup table and the static method that does the match.

```java
public enum RobotIDYearly implements RobotID {
  PRODUCTION("Production Bot"),
  PRACTICE("Practice Bot");

  private final String name;
  private String macAddress = null; // filled in by withMACAddress at boot

  private RobotIDYearly(String name) {
    this.name = name;
  }

  @Override
  public RobotID withMACAddress(String mac) {
    this.macAddress = mac;
    return this;
  }

  @Override
  public String getName() {
    return name;
  }

  @Override
  public String getMACAddress() {
    return macAddress;
  }

  private static final Map<String, RobotID> ROBOT_TO_MAC =
      Map.of(
          "00:80:2f:aa:bb:cc", PRODUCTION,
          "00:80:2f:dd:ee:ff", PRACTICE);

  private static final RobotID DEFAULT_ROBOT = PRODUCTION;

  public static RobotID getIdentification() {
    String macAddress = NetworkUtils.MAC.getMACAddress();
    return ROBOT_TO_MAC.getOrDefault(macAddress, DEFAULT_ROBOT).withMACAddress(macAddress);
  }
}
```

`getIdentification` is not part of the interface. It is a convention the season code follows, and `RobotRuntimeConstants` calls it to populate `ROBOT_ID`.

:::info
In simulation `NetworkUtils.MAC.getMACAddress()` returns whatever the desktop's first network interface reports, which will not be in the table, so the default robot is always selected.
:::

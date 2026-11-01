# Embedded integration design - simulated prototype

## Labelled topology

```text
                  HOST PC / Workbench C++ adapters
                    | USB host and common reference
              powered USB hub (power budget checked)
                /               |                 \
     USB to Nucleo CN1     USB to Arty J10      USB to ST-LINK/V2
     ST-LINK/V2-1 bridge   UART + onboard JTAG   external debug master
             |                  |                     |
     STM32F401RE target     Artix-7 FPGA       keyed SWD breakout harness
      USART2 telemetry      UART telemetry       Vref / GND / IO / CLK / RST
             ^                                        |
             +------- external target debug path -----+
          isolate onboard SWD master before attaching external probe
```

All three device types are represented independently in the UI. The external ST-LINK is an alternative STM32 debug master, not an FPGA accelerator or a generic compute board. STM32 uses SWD in this design; ST-LINK/V2 also supports JTAG. Arty uses its own supported onboard programming bridge. No assumption is made that the two debug interfaces share connectors or protocols.

## Interface and pin/voltage table

| Module/link | Power / voltage | Connector and signals | Direction / ownership |
|---|---|---|---|
| NUCLEO-F401RE / MB1136 | USB 5 V to board regulator; MCU logic 3.3 V | CN1 mini-USB; USART2 PA2 TX and PA3 RX via onboard VCP bridge | MCU owns TX; bridge owns RX drive; default solder-bridge routing must be checked against actual revision |
| Arty A7-35T | USB-powered board; expansion digital I/O design assumes 3.3 V | J10 micro-USB UART and onboard JTAG; no raw PC USB-to-GPIO wiring | Board bridge owns host transport; FPGA design must implement UART telemetry; no bitstream supplied |
| Genuine ST-LINK/V2, CN3 20-pin | USB-powered probe; VAPP senses target VDD | Pin 1 VAPP -> target 3.3 V reference; pin 4 GND -> target GND; pin 7 TMS/SWDIO -> PA13; pin 9 TCK/SWCLK -> PA14; pin 15 NRST -> target NRST | Probe owns clock and reset; SWDIO bidirectional. Ground and reference first. Pin 19 is not used as a target power supply |
| JTAG mode capability, not selected wiring | Reference must match actual target I/O domain | TCK, TMS, TDI: adapter to target; TDO: target to adapter; optional nTRST/nRESET | One active debug master per target; connector mappings are device-specific |
| Optional future direct board link | Explicit matching 3.3 V domains required | Separate keyed signal/GND cable | Add a direction-appropriate level translator if domains differ; never attach 5 V GPIO directly to FPGA I/O |

The external STM32 harness is a design assumption: select target-side PA13/PA14/NRST/GND/3V3 access from the actual MB1136 schematic and isolate the onboard SWD connection before use. CN4 is part of the onboard ST-LINK interface and must not be assumed to be an interchangeable target connector. No physical harness has been built or electrically verified.

## Safe integration sequence

1. Identify the precise board revision and genuine probe pinout; inspect connector orientation.
2. Disconnect power before wiring; select one supported board power source and prevent back-feeding through supply jumpers.
3. Check USB power budget and common ground. Measure target reference voltage before enabling debug outputs.
4. Ensure the onboard and external debug masters cannot drive the target simultaneously.
5. Use short keyed cables and correct voltage translation where needed. Start at low debug clock speed.
6. Discover the device, validate capability and target identity, connect, read a benign status, and disconnect on timeout.
7. Recover by reconnecting after correcting the cause. Never automatically erase/program a target during discovery.

## Mock contract

Request: `device action`, where device is `microcontroller`, `fpga`, or `jtag`; actions are inspect, connect, telemetry, timeout, disconnect. C++ owns state under a mutex. Telemetry is one fixed deterministic simulated status message. A timeout moves the device to disconnected; telemetry then fails until reconnect. HTTP integration tests exercise the full sequence for each device.

## Sources and assumptions

- [ST UM1724, Nucleo-64 MB1136 manual](https://www.st.com/resource/en/user_manual/dm00105823-nucleo-f401re-user-manual-stmicroelectronics.pdf): board connectors and onboard ST-LINK arrangement.
- [ST UM1075, ST-LINK/V2 manual, Table 4](https://www.st.com/resource/en/user_manual/dm00026748.pdf): CN3 pin mapping and target reference arrangement.
- [Digilent Arty A7 E.2 schematic](https://digilent.com/reference/_media/programmable-logic/arty-a7/arty-a7-e2-sch.pdf): board-specific supply and signal domains.
- [Digilent-authored Arty A7 reference manual, distributor-hosted copy](https://static6.arrow.com/aropdfconversion/2be812c0b082a473dd18840c5cee7fdd25115a5a/pgurl_7962329305554987.pdf): UART/JTAG facilities. The vendor reference page returned HTTP 403 during retrieval.

This is an integration proposal with working mocks, not a wiring certification or tested physical implementation.

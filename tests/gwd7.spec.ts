import { test, expect } from "@playwright/test";
import { GwdClient, GwdMessage } from "../src/gwd-client";
const gwd = new GwdClient();

const selectedCases = (process.env.DISPATCH_CASES ?? "1")
  .split(",")
  .map((value) => value.trim());
if (
  selectedCases.some((value) => !/^(?:[1-9]|10)$/.test(value)) ||
  new Set(selectedCases).size !== selectedCases.length
) {
  throw new Error(
    "DISPATCH_CASES must contain unique case numbers from 1 to 10, separated by commas (for example: 1,3,7)."
  );
}

const dispatchDelayMsValue = process.env.DISPATCH_DELAY_MS ?? "0";
const dispatchDelayMs = Number(dispatchDelayMsValue);
if (
  !/^\d+$/.test(dispatchDelayMsValue) ||
  !Number.isSafeInteger(dispatchDelayMs) ||
  dispatchDelayMs > 2_147_483_647
) {
  throw new Error(
    "DISPATCH_DELAY_MS must be a non-negative integer no greater than 2147483647."
  );
}

const dispatchRepeatCountValue = process.env.DISPATCH_REPEAT_COUNT ?? "1";
const dispatchRepeatCount = Number(dispatchRepeatCountValue);
if (
  !/^[1-9]\d*$/.test(dispatchRepeatCountValue) ||
  !Number.isSafeInteger(dispatchRepeatCount)
) {
  throw new Error(
    "DISPATCH_REPEAT_COUNT must be a positive safe integer."
  );
}

test("Complete Dispatch Process", async ({}, testInfo) => {
  const additionalDelayMs =
    (dispatchRepeatCount - 1) * selectedCases.length * dispatchDelayMs;
  test.setTimeout(Math.min(2_147_483_647, 300_000 + additionalDelayMs));
  const gwd = new GwdClient();
  const dispatchReport: Array<{
    pass: number;
    caseNumber: number;
    response: unknown;
  }> = [];

  try {
    await test.step("Connect", async () => {
      console.log("\n========== STEP 1: Connect ==========");
      await gwd.connect();
  });

  
  // ========================================
  // LOGIN
  // ========================================
  await test.step("Login", async () => {
      console.log("\n========== STEP 2: Login ==========");
  const loginRsp = await gwd.login();
  expect(loginRsp.MT).toBe("Rsp");
  console.log("LOGIN:", JSON.stringify(loginRsp, null, 2));

  const accessToken = loginRsp.Data?.AccessToken;
  if (accessToken) {
    console.log("[AUTH] AccessToken received:", accessToken);
  }
});

 // ========================================
 // REGISTER EVENTS
 // ========================================
 await test.step("RegisterEvent", async () => {
      console.log("\n========== STEP 3: RegisterEvent ==========");
  const registerRsp = await gwd.registerEvent("App.*");
  //const registerRsp = await gwd.registerEvent("App.DispatchProcessFeedback");
  //const registerRsp = await gwd.registerEvent("App.DispatchProcessResult");
  expect(registerRsp.MT).toBe("Rsp");

  console.log(
    "REGISTER EVENT:",
    JSON.stringify(registerRsp, null, 2)
  );
  });

// ========================================
// LISTEN FOR INCOMING EVENTS
// ========================================
 await test.step("Listen for incoming events", async () => {
      console.log("\n========== STEP 4: ListenForEvents ==========");
const eventPromise = gwd.waitForEvent(
  msg => msg.MT !== "Rsp",
  30_000
);

  gwd.onEvent((event) => {
    console.log(
      "######## EVENT RECEIVED ########"
    );

    console.log(
      JSON.stringify(event, null, 2)
    );
  });
});

await test.step("Device info", async () => {
      console.log("\n========== STEP 5: Device Info ==========");
  // ----------- Device Info
  const infoRsp = await gwd.request("GetDeviceInfo", {});
  expect(infoRsp.MT).toBe("Rsp");
  console.log("DEVICE INFO:", JSON.stringify(infoRsp.Data, null, 2));
});

/* Simulation is not working as server always sends coded feedback
// ========================================
// SIMULATE DISPATCH FEEDBACK
// ========================================
const feedbackData = {
  ProcessID: 45325,

  Wristband_Dispatch_Feedback: [
    {
      Query_Param: {
        SizeId: "152"
      },

      RateId: "UserDefRate1",

      State: {
        Description: "-",
        State: "OK"
      },

      Wristband: {
        ColorId: "b",
        SizeId: "152",
        UID: "E00510000A1C9C7D"
      }
    }
  ]
};

gwd.sendDispatchProcessFeedback(feedbackData);
*/

await test.step("Start Dispatch Process", async () => {
      console.log("\n========== STEP 6: Start Dispatch Process ==========");
  // ========================================
  // START DISPATCH PROCESS
  // ========================================
  const dispatchRequests = [
    {
      Language: "de",
      ProcessID: 45325,
      Skip_Selection: false,
      Wristband_Selection: [
        {
          Amount: 1,
          Query_Param: { SizeId: "195" },
          RateId: "UserDefRate1",
        },
        {
          Amount: 2,
          Query_Param: { SizeId: "180" },
          RateId: "UserDefRate2",
        },
      ],
              "Rate_Mapping": [
            {
                "ColorConf": {
                    "Choice": "all",
                    "default": null
                },
                "Display_Text": {
                    "de": "Erwachsen Bad+Sauna",
                    "en": "Adult Pool + Sauna"
                },
                "RateId": "UserDefRate1",
                "SizeConf": {
                    "Choice": [
                        "180",
                        "195",
                        "152",
                        "220"
                    ],
                    "default": "180"
                }
            },
            {
                "Display_Text": {
                    "de": "Kind Bad",
                    "en": "Child pool"
                },
                "RateId": "UserDefRate2",
                "SizeConf": {
                    "Choice": [
                        "152",
                        "220"
                    ],
                    "default": "152"
                }
            }
        ]
    },
    {
      Language: "de",
      ProcessID: 45325,
      Skip_Selection: true,
      Wristband_Selection: [
        {
          Amount: 2,
          Query_Param: { SizeId: "152" },
          RateId: "UserDefRate1",
        },
      ],
    },
    {
      Language: "de",
      ProcessID: 45325,
      Skip_Selection: true,
      Wristband_Selection: [
        {
          Amount: 3,
          Query_Param: { SizeId: "180" },
          RateId: "UserDefRate1",
        },
      ],
    },
    {
      Language: "de",
      ProcessID: 45325,
      Skip_Selection: true,
      Wristband_Selection: [
        {
          Amount: 1,
          Query_Param: { SizeId: "195" },
          RateId: "UserDefRate1",
        },
      ],
    },
    {
      Language: "de",
      ProcessID: 45325,
      Skip_Selection: true,
      Wristband_Selection: [
        {
          Amount: 2,
          Query_Param: { SizeId: "220" },
          RateId: "UserDefRate1",
        },
      ],
    },
    {
      Language: "de",
      ProcessID: 45325,
      Skip_Selection: true,
      Wristband_Selection: [
        {
          Amount: 3,
          Query_Param: { SizeId: "152" },
          RateId: "UserDefRate1",
        },
      ],
    },
    {
      Language: "de",
      ProcessID: 45325,
      Skip_Selection: true,
      Wristband_Selection: [
        {
          Amount: 1,
          Query_Param: { SizeId: "180" },
          RateId: "UserDefRate1",
        },
      ],
    },
    {
      Language: "de",
      ProcessID: 45325,
      Skip_Selection: true,
      Wristband_Selection: [
        {
          Amount: 2,
          Query_Param: { SizeId: "195" },
          RateId: "UserDefRate1",
        },
      ],
    },
    {
      Language: "de",
      ProcessID: 45325,
      Skip_Selection: true,
      Wristband_Selection: [
        {
          Amount: 3,
          Query_Param: { SizeId: "220" },
          RateId: "UserDefRate1",
        },
      ],
    },
    {
      Language: "de",
      ProcessID: 45325,
      Skip_Selection: true,
      Wristband_Selection: [
        {
          Amount: 1,
          Query_Param: { SizeId: "220" },
          RateId: "UserDefRate1",
        },
      ],
    },
  ];

  const caseNumbers = selectedCases.map(Number);
  const totalDispatchCount = caseNumbers.length * dispatchRepeatCount;
  let dispatchIndex = 0;
  for (let pass = 1; pass <= dispatchRepeatCount; pass++) {
    for (const caseNumber of caseNumbers) {
      await test.step(`Pass ${pass}: Dispatch case ${caseNumber}`, async () => {
        const jsonData = dispatchRequests[caseNumber - 1];
        const dispatchRsp = await gwd.request(
          "App.StartDispatchProcess",
          jsonData
        );

        expect(dispatchRsp.MT).toBe("Rsp");
        dispatchReport.push({
          pass,
          caseNumber,
          response: dispatchRsp.Data,
        });
        console.log(
          `DISPATCH-PROCESS PASS ${pass}, CASE ${caseNumber}:`,
          JSON.stringify(dispatchRsp.Data, null, 2)
        );
      });

      dispatchIndex++;
      if (dispatchDelayMs > 0 && dispatchIndex < totalDispatchCount) {
        console.log(`Waiting ${dispatchDelayMs} ms before the next dispatch.`);
        await new Promise<void>((resolve) => setTimeout(resolve, dispatchDelayMs));
      }
    }
  }

  await testInfo.attach("dispatch-process-results.json", {
    body: JSON.stringify(dispatchReport, null, 2),
    contentType: "application/json",
  });
});
// -------------- Wait for event
//const event = await eventPromise;

//console.log(
//  "APP EVENT:",
//  JSON.stringify(event, null, 2)
//);

 } finally {
    gwd.close();
}

});
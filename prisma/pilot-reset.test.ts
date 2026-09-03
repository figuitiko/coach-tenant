import { describe, expect, it } from "vitest";
import { resetPilotFixtures } from "./pilot-reset";

describe("resetPilotFixtures", () => {
  it("deletes the pilot graph in topological order inside one transaction", async () => {
    const calls: string[] = [];
    const model = (name: string) => ({ deleteMany: async () => { calls.push(name); return { count: 1 }; } });
    const updatableModel = (name: string) => ({ ...model(name), updateMany: async () => { calls.push(`${name}:update`); return { count: 1 }; } });
    const transaction = {
      workspace: {
        findMany: async () => [
          { id: "pilot-workspace-north" },
          { id: "pilot-workspace-south" },
        ],
        ...model("workspace"),
      },
      user: {
        findMany: async () => [{ id: "accepted-pilot-user" }],
        ...model("user"),
      },
      account: model("account"),
      reviewReply: model("reviewReply"),
      reviewNote: model("reviewNote"),
      landingRevisionResult: model("landingRevisionResult"),
      landingCredibilityFact: model("landingCredibilityFact"),
      landingProgram: model("landingProgram"),
      landingMethodStep: model("landingMethodStep"),
      landingFaq: model("landingFaq"),
      coachLandingRevision: model("coachLandingRevision"),
      coachLanding: updatableModel("coachLanding"),
      studentResultApproval: model("studentResultApproval"),
      studentResultMetricSnapshot: model("studentResultMetricSnapshot"),
      studentResultVersion: model("studentResultVersion"),
      studentResultStory: updatableModel("studentResultStory"),
      publicLandingMetricDaily: model("publicLandingMetricDaily"),
      marketingAsset: model("marketingAsset"),
      marketingAssetUploadIntent: model("marketingAssetUploadIntent"),
      progressPhoto: model("progressPhoto"),
      photoUploadIntent: model("photoUploadIntent"),
      measurementCheckIn: model("measurementCheckIn"),
      setLog: model("setLog"),
      exerciseLog: model("exerciseLog"),
      workoutSession: model("workoutSession"),
      assignedExercise: model("assignedExercise"),
      assignedWorkout: model("assignedWorkout"),
      studentPlanAssignment: model("studentPlanAssignment"),
      planWorkout: model("planWorkout"),
      workoutPlan: model("workoutPlan"),
      templateExercise: model("templateExercise"),
      workoutTemplate: model("workoutTemplate"),
      exercise: model("exercise"),
      invitation: model("invitation"),
      auditEvent: model("auditEvent"),
      productEvent: model("productEvent"),
      membership: model("membership"),
    };
    const database = {
      $transaction: async (operation: (tx: typeof transaction) => Promise<void>) => {
        calls.push("transaction:start");
        await operation(transaction);
        calls.push("transaction:commit");
      },
    };

    await resetPilotFixtures(database as never);

    expect(calls).toEqual([
      "transaction:start",
      "reviewReply", "reviewNote",
      "coachLanding:update", "studentResultStory:update",
      "landingRevisionResult", "landingCredibilityFact", "landingProgram", "landingMethodStep", "landingFaq",
      "publicLandingMetricDaily", "studentResultApproval", "studentResultMetricSnapshot",
      "coachLandingRevision", "coachLanding", "studentResultVersion", "studentResultStory",
      "marketingAsset", "marketingAssetUploadIntent",
      "progressPhoto", "photoUploadIntent", "measurementCheckIn",
      "setLog", "exerciseLog", "workoutSession", "assignedExercise", "assignedWorkout",
      "studentPlanAssignment", "planWorkout", "workoutPlan",
      "templateExercise", "workoutTemplate", "exercise",
      "invitation", "auditEvent", "productEvent", "membership", "workspace",
      "account", "user",
      "transaction:commit",
    ]);
  });

  it("targets only fixed pilot workspaces and fixture identities", async () => {
    const deletes: Array<{ model: string; input: unknown }> = [];
    const model = (name: string) => ({ deleteMany: async (input: unknown) => { deletes.push({ model: name, input }); return { count: 0 }; } });
    const updatableModel = (name: string) => ({ ...model(name), updateMany: async (input: unknown) => { deletes.push({ model: `${name}:update`, input }); return { count: 0 }; } });
    const transaction = {
      workspace: { findMany: async () => [{ id: "pilot-workspace-north" }, { id: "pilot-workspace-south" }], ...model("workspace") },
      user: { findMany: async () => [], ...model("user") },
      account: model("account"), reviewReply: model("reviewReply"), reviewNote: model("reviewNote"),
      landingRevisionResult: model("landingRevisionResult"), landingCredibilityFact: model("landingCredibilityFact"),
      landingProgram: model("landingProgram"), landingMethodStep: model("landingMethodStep"), landingFaq: model("landingFaq"),
      coachLandingRevision: model("coachLandingRevision"), coachLanding: updatableModel("coachLanding"),
      studentResultApproval: model("studentResultApproval"), studentResultMetricSnapshot: model("studentResultMetricSnapshot"),
      studentResultVersion: model("studentResultVersion"), studentResultStory: updatableModel("studentResultStory"),
      publicLandingMetricDaily: model("publicLandingMetricDaily"),
      marketingAsset: model("marketingAsset"), marketingAssetUploadIntent: model("marketingAssetUploadIntent"),
      progressPhoto: model("progressPhoto"),
      photoUploadIntent: model("photoUploadIntent"), measurementCheckIn: model("measurementCheckIn"),
      setLog: model("setLog"), exerciseLog: model("exerciseLog"), workoutSession: model("workoutSession"),
      assignedExercise: model("assignedExercise"), assignedWorkout: model("assignedWorkout"),
      studentPlanAssignment: model("studentPlanAssignment"), planWorkout: model("planWorkout"),
      workoutPlan: model("workoutPlan"), templateExercise: model("templateExercise"),
      workoutTemplate: model("workoutTemplate"), exercise: model("exercise"), invitation: model("invitation"),
      auditEvent: model("auditEvent"), productEvent: model("productEvent"), membership: model("membership"),
    };
    const database = { $transaction: (operation: (tx: typeof transaction) => Promise<void>) => operation(transaction) };

    await resetPilotFixtures(database as never);

    expect(deletes.find(({ model }) => model === "workspace")?.input).toEqual({ where: { id: { in: ["pilot-workspace-north", "pilot-workspace-south"] } } });
    expect(deletes.find(({ model }) => model === "planWorkout")?.input).toEqual({ where: { OR: [
      { plan: { workspaceId: { in: ["pilot-workspace-north", "pilot-workspace-south"] } } },
      { template: { workspaceId: { in: ["pilot-workspace-north", "pilot-workspace-south"] } } },
    ] } });
    expect(deletes.find(({ model }) => model === "studentPlanAssignment")?.input).toEqual({ where: { OR: [
      { workspaceId: { in: ["pilot-workspace-north", "pilot-workspace-south"] } },
      { plan: { workspaceId: { in: ["pilot-workspace-north", "pilot-workspace-south"] } } },
      { studentMembership: { workspaceId: { in: ["pilot-workspace-north", "pilot-workspace-south"] } } },
    ] } });
    expect(deletes.find(({ model }) => model === "user")?.input).toEqual({ where: { id: { in: [
      "pilot-coach", "pilot-admin", "pilot-coach-north", "pilot-coach-south",
      "pilot-student-1", "pilot-student-2", "pilot-student-3", "pilot-student-4", "pilot-student-5",
    ] } } });
    expect(deletes.find(({ model }) => model === "coachLanding")?.input).toEqual({ where: { workspaceId: { in: ["pilot-workspace-north", "pilot-workspace-south"] } } });
    expect(deletes.find(({ model }) => model === "landingRevisionResult")?.input).toEqual({ where: { workspaceId: { in: ["pilot-workspace-north", "pilot-workspace-south"] } } });
    expect(deletes.find(({ model }) => model === "studentResultApproval")?.input).toEqual({ where: { workspaceId: { in: ["pilot-workspace-north", "pilot-workspace-south"] } } });
  });
});

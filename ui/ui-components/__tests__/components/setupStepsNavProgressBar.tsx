import { screen } from "@testing-library/react";
import mockAxios from "jest-mock-axios";
import Component from "../../components/navigation/SetupStepsNavProgressBar";
import { Actions } from "../../utils/apiData";
import { asyncRenderWithContext } from "../__utils__/renderWithContext";

const useRouter = jest.spyOn(require("next/router"), "useRouter");

describe("setupStepsNavProgressBar", () => {
  describe("hidden", () => {
    beforeEach(() => {
      useRouter.mockImplementation(() => ({
        pathname: "/",
        asPath: "/",
      }));
    });

    for (const page of ["/", "/session/sign-in"]) {
      it(`does not render on ${page}`, async () => {
        useRouter.mockImplementation(() => ({ pathname: page, asPath: page }));
        await asyncRenderWithContext(<Component />);
        expect(screen.queryByTestId("setupStepsProgressBar")).toBeNull();
      });
    }
  });

  describe("on a logged in page", () => {
    beforeEach(() => {
      useRouter.mockImplementation(() => ({
        pathname: "/dashboard",
        asPath: "/dashboard",
        prefetch: async () => {},
      }));
    });

    afterEach(() => {
      mockAxios.reset();
    });

    it("doesn't display without steps", async () => {
      await asyncRenderWithContext(<Component />);
      expect(screen.queryByTestId("setupStepsProgressBar")).toBeNull();
    });

    it("displays with steps", async () => {
      let stepsResponse: Actions.SetupStepsList = {
        setupSteps: [
          {
            id: "1",
            position: 1,
            key: "1",
            title: "do a thing",
            description: "please do this thing",
            href: "/a/b/c",
            cta: "click me",
            helpLink: "https://www.grouparoo.com/help",
            showCtaOnCommunity: true,
            outcome: "yay",
            skipped: false,
            disabled: false,
            complete: false,
            createdAt: 1,
            updatedAt: 1,
          },
        ],
      };

      await asyncRenderWithContext(<Component />);

      expect(mockAxios).toHaveBeenCalledWith(
        expect.objectContaining({
          method: "get",
          url: "/api/v1/setupSteps",
        })
      );
      mockAxios.mockResponse({ data: stepsResponse });

      const element = await screen.findByTestId("setupStepsProgressBar");
      expect(element).toHaveTextContent("Get Started:");
      expect(element).toHaveTextContent("do a thing");
    });

    it("does not appear when all setup steps are complete", async () => {
      let stepsResponse: Actions.SetupStepsList = {
        setupSteps: [
          {
            id: "1",
            position: 1,
            key: "1",
            title: "do a thing",
            description: "please do this thing",
            href: "/a/b/c",
            cta: "click me",
            helpLink: "https://www.grouparoo.com/help",
            showCtaOnCommunity: true,
            outcome: "yay",
            skipped: false,
            disabled: false,
            complete: true,
            createdAt: 1,
            updatedAt: 1,
          },
        ],
      };

      await asyncRenderWithContext(<Component />);

      mockAxios.mockResponse({ data: stepsResponse });
      await expect(
        screen.findByTestId("setupStepsProgressBar")
      ).rejects.toThrow(/Unable to find an element/);
    });
  });
});

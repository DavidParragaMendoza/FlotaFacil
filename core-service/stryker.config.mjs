/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
	packageManager: "npm",
	testRunner: "vitest",
	vitest: {
		configFile: "vitest.config.ts",
	},
	coverageAnalysis: "perTest",
	mutate: [
		"src/contracts/users/user-login-schema.ts",
		"src/contracts/users/create-user-schema.ts",
		"src/contracts/vehicles/register-vehicle-request-schema.ts",
		"src/contracts/requests/create-my-request-schema.ts",
		"src/hooks/verify-jwt.ts",
		"src/hooks/authorize.ts",
		"src/use-cases/authenticate-admin.ts",
		"src/use-cases/users/create-user.ts",
		"src/use-cases/users/fetch-user-by-id.ts",
		"src/use-cases/vehicles/register-vehicle.ts",
		"src/use-cases/vehicles/fetch-available-vehicles.ts",
		"src/use-cases/vehicles/update-vehicle.ts",
		"src/use-cases/vehicles/delete-vehicle.ts",
		"src/use-cases/requests/create-my-request.ts",
	],
	ignorePatterns: ["/dist", "/coverage", "/reports", "/.stryker-tmp"],
	reporters: ["html", "clear-text", "progress", "json"],
	htmlReporter: {
		fileName: "reports/mutation/index.html",
	},
	jsonReporter: {
		fileName: "reports/mutation/mutation.json",
	},
	timeoutMS: 30000,
};

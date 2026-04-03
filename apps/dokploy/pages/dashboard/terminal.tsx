import { IS_CLOUD, validateRequest } from "@dokploy/server";
import type { GetServerSidePropsContext } from "next";
import dynamic from "next/dynamic";
import type { ReactElement } from "react";
import { DashboardLayout } from "@/components/layouts/dashboard-layout";
import LocalServerConfig from "@/components/dashboard/settings/web-server/local-server-config";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";

const Terminal = dynamic(
	() =>
		import("@/components/dashboard/settings/web-server/terminal").then(
			(e) => e.Terminal,
		),
	{ ssr: false },
);

const TerminalPage = () => {
	return (
		<div className="w-full max-w-7xl mx-auto">
			<Card className="bg-sidebar p-2.5 rounded-xl">
				<div className="rounded-xl bg-background shadow-md">
					<CardHeader>
						<CardTitle className="text-xl">Terminal</CardTitle>
						<CardDescription>
							Direct shell access to your Dokploy server
						</CardDescription>
					</CardHeader>
					<CardContent className="flex flex-col gap-4">
						<LocalServerConfig onSave={() => {}} />
						<div className="h-[600px]">
							<Terminal id="main-terminal" serverId="local" />
						</div>
					</CardContent>
				</div>
			</Card>
		</div>
	);
};

export default TerminalPage;

TerminalPage.getLayout = (page: ReactElement) => {
	return <DashboardLayout metaName="Terminal">{page}</DashboardLayout>;
};

export async function getServerSideProps(
	ctx: GetServerSidePropsContext,
) {
	const { req } = ctx;
	if (IS_CLOUD) {
		return {
			redirect: {
				permanent: true,
				destination: "/dashboard/projects",
			},
		};
	}
	const { user } = await validateRequest(req);
	if (!user) {
		return {
			redirect: {
				permanent: true,
				destination: "/",
			},
		};
	}
	return { props: {} };
}

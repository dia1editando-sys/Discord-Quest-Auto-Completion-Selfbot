import { GatewayDispatchEvents } from 'discord-api-types/v10';
import { ClientQuest } from './src/client';

let currentUserId: string | null = null;

const token = process.env.TOKEN;

if (!token) {
	console.error('TOKEN não encontrada nas variáveis do Railway.');
	process.exit(1);
}

const client = new ClientQuest(token);

client.once(GatewayDispatchEvents.Ready, async ({ data }) => {
	currentUserId = data.user.id;

	console.log(`Logged in as ${data.user.username}`);

	try {
		await client.fetchQuests(false);

		const questsValid = client
			.questManager!
			.filterQuestsValidToDo();

		console.log(`Found ${questsValid.length} valid quests to do.`);

		await Promise.allSettled(
			questsValid.map((quest) =>
				client.questManager!.doingQuest(quest),
			),
		);

		console.log('All quests processed.');
	} catch (err) {
		console.error('Quest error:', err);
	} finally {
		console.log('Disconnecting...');
		await client.destroy();
	}
});

process.on('unhandledRejection', (reason) => {
	console.error('[UnhandledRejection]', reason);
});

process.on('uncaughtException', (error) => {
	console.error('[UncaughtException]', error);
});

client.connect();

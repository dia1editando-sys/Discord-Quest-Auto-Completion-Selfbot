import { GatewayDispatchEvents } from 'discord-api-types/v10';
import { ClientQuest } from './src/client';

const token = process.env.TOKEN?.trim();

if (!token) {
	console.error('ERRO: TOKEN não encontrada.');
	process.exit(1);
}

// Lista global de localidades (Brasil primeiro para garantir o que você vê no celular)
const ALL_LOCALES = [
	'pt-BR', 'en-US', 'en-GB', 'en-CA', 'fr-FR', 'de-DE', 'es-ES', 'ja-JP'
];

const client = new ClientQuest(token);

let isChecking = false;
let initialized = false;

// Delay humano entre 15 e 20 segundos
const randomDelay = () => {
	const ms = Math.floor(Math.random() * (20000 - 15000 + 1) + 15000);
	return new Promise((r) => setTimeout(r, ms));
};

async function checkQuests() {
	if (isChecking) return;
	isChecking = true;

	try {
		console.log('\n--- [INICIANDO VARREDURA GLOBAL + AUTO-RESGATE] ---');

		for (const locale of ALL_LOCALES) {
			console.log(`[MAPA] Verificando região: ${locale}`);
			
			if (typeof client.setLocale === 'function') {
				client.setLocale(locale);
			}

			await client.fetchQuests(false);

			// Pega as missões que podem ser feitas ou que já terminaram e precisam de resgate
			const quests = client.questManager!.filterQuestsValidToDo();

			if (quests.length === 0) continue;

			console.log(`[INFO] ${quests.length} missões identificadas em ${locale}.`);

			for (const quest of quests) {
				try {
					console.log(`[LOG] Processando Quest: ${quest.id}`);

					// 1. ACEITAR (Muitas quests de fora só resgatam se você aceitar antes)
					const qm = client.questManager! as any;
					if (qm.acceptQuest) {
						await qm.acceptQuest(quest.id).catch(() => {});
					}

					// 2. EXECUTAR PROGRESSO
					await qm.doingQuest(quest);
					
					// Aguarda 5 segundos para o servidor do Discord registrar o fim da quest
					await new Promise((r) => setTimeout(r, 5000));

					// 3. TENTATIVA DE RESGATE MULTI-MÉTODO (A solução para coletar sozinho)
					console.log(`[ORBS] Tentando resgatar recompensa...`);
					
					// Lista de nomes de funções possíveis para resgate
					const claimMethods = ['claimReward', 'claimQuest', 'collectReward', 'redeemReward', 'getReward'];
					let successClaim = false;

					for (const method of claimMethods) {
						if (typeof qm[method] === 'function') {
							try {
								// Tenta passar o objeto da quest ou apenas o ID
								await qm[method](quest);
								successClaim = true;
								break; 
							} catch {
								try {
									await qm[method](quest.id);
									successClaim = true;
									break;
								} catch { continue; }
							}
						}
					}

					if (successClaim) {
						console.log(`[SUCESSO] Recompensa coletada para: ${quest.id}`);
					} else {
						console.warn(`[AVISO] Missão terminada, mas o método de resgate não foi encontrado no seu client.`);
					}

					// Intervalo de segurança anti-ban
					console.log(`[WAIT] Aguardando intervalo de segurança...`);
					await randomDelay();
					
				} catch (err) {
					console.error(`[ERRO NA QUEST] ${quest.id}:`, err.message || err);
				}
			}
		}
		console.log('--- [AGUARDANDO PRÓXIMO CICLO DE 5 MINUTOS] ---\n');
	} catch (err) {
		console.error('[ERRO NO PROCESSO GLOBAL]', err);
	} finally {
		isChecking = false;
	}
}

client.once(GatewayDispatchEvents.Ready, async ({ data }) => {
	console.log(`>>> BOT CONECTADO: ${data.user.username}`);

	if (initialized) return;
	initialized = true;

	await checkQuests();

	setInterval(async () => {
		await checkQuests();
	}, 1000 * 60 * 5);
});

process.on('unhandledRejection', (reason) => console.error('[Fatal] Rejeição:', reason));
process.on('uncaughtException', (error) => console.error('[Fatal] Exceção:', error));

client.connect();
						 

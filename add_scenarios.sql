INSERT INTO scenarios (
	id,
	name,
	description,
	attack_tactic,
	attack_technique_id,
	docker_image,
	flag,
	difficulty
)
VALUES
	(
		'550e8400-e29b-41d4-a716-446655440000',
		'Brute Force SSH',
		'An SSH server running on an open port. Crack the password using hybrid.',
		'Credential Access',
		'T1078',
		'alpine',
		'CR{ssh_master}',
		'easy'
	),
	(
		'660e8400-e29b-41d4-a716-446655440000',
		'Path Traversal',
		'A file server with a hidden flag in /root/secret.txt. Break out of www.',
		'Defense Evasion',
		'T1083',
		'httpd',
		'CR{path_master}',
		'medium'
	),
	(
		'440e8400-e29b-41d4-a716-446655440000',
		'Web Shell Upload',
		'A web server that allows file uploads. Try uploading a webshell image.',
		'Persistence',
		'T1505.003',
		'nginx',
		'CR{webshell_king}',
		'hard'
	),
	(
		'770e8400-e29b-41d4-a716-446655440000',
		'Beginner Linux Recon',
		'Explore a Linux container, locate the hidden flag file, and submit it.',
		'Discovery',
		'T1083',
		'alpine',
		'CR{recon_starter}',
		'easy'
	)
ON CONFLICT (id) DO UPDATE SET
	name = EXCLUDED.name,
	description = EXCLUDED.description,
	attack_tactic = EXCLUDED.attack_tactic,
	attack_technique_id = EXCLUDED.attack_technique_id,
	docker_image = EXCLUDED.docker_image,
	flag = EXCLUDED.flag,
	difficulty = EXCLUDED.difficulty;

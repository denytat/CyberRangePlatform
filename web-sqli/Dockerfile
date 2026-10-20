FROM alpine:3.18

RUN apk add --no-cache php82 php82-sqlite3 sqlite \
	&& mkdir -p /var/www/html /var/www/db \
	&& sqlite3 /var/www/db/users.db <<'SQL'
CREATE TABLE users (
	id INTEGER PRIMARY KEY,
	username TEXT NOT NULL,
	password TEXT NOT NULL,
	secret TEXT
);

INSERT INTO users (id, username, password, secret) VALUES
	(1, 'admin', 'pass', 'CR{injection_master}'),
	(2, 'guest', 'pass', NULL);
SQL

RUN cat > /var/www/html/index.php <<'PHP'
<?php
$db = new SQLite3('/var/www/db/users.db');
$id = $_GET['id'] ?? '';
$results = [];
$error = '';

if ($id !== '') {
	// Deliberately vulnerable: this scenario demonstrates SQL injection.
	$query = "SELECT * FROM users WHERE id = $id";
	$result = $db->query($query);

	if ($result === false) {
		$error = $db->lastErrorMsg();
	} else {
		while ($row = $result->fetchArray(SQLITE3_ASSOC)) {
			$results[] = $row;
		}
	}
}
?>
<!doctype html>
<html lang="en">
<head>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<title>Product Search</title>
	<style>
		body { max-width: 48rem; margin: 3rem auto; padding: 0 1rem; font: 16px sans-serif; }
		input, button { padding: 0.55rem; }
		input { width: 12rem; }
		table { border-collapse: collapse; margin-top: 1.5rem; width: 100%; }
		th, td { border: 1px solid #bbb; padding: 0.55rem; text-align: left; }
		.error { color: #a00; }
	</style>
</head>
<body>
	<h1>Search products</h1>
	<p>Search the catalogue by product ID.</p>
	<form method="get">
		<label for="id">Product ID</label>
		<input id="id" name="id" value="<?= htmlspecialchars($id, ENT_QUOTES, 'UTF-8') ?>" required>
		<button type="submit">Search</button>
	</form>

	<?php if ($error !== ''): ?>
		<p class="error">Database error: <?= htmlspecialchars($error, ENT_QUOTES, 'UTF-8') ?></p>
	<?php elseif ($results): ?>
		<table>
			<thead><tr><th>ID</th><th>Username</th><th>Password</th><th>Secret</th></tr></thead>
			<tbody>
			<?php foreach ($results as $row): ?>
				<tr>
					<td><?= htmlspecialchars($row['id'], ENT_QUOTES, 'UTF-8') ?></td>
					<td><?= htmlspecialchars($row['username'], ENT_QUOTES, 'UTF-8') ?></td>
					<td><?= htmlspecialchars($row['password'], ENT_QUOTES, 'UTF-8') ?></td>
					<td><?= htmlspecialchars($row['secret'] ?? '', ENT_QUOTES, 'UTF-8') ?></td>
				</tr>
			<?php endforeach; ?>
			</tbody>
		</table>
	<?php elseif ($id !== ''): ?>
		<p>No products found.</p>
	<?php endif; ?>
</body>
</html>
PHP

EXPOSE 80

CMD ["php82", "-S", "0.0.0.0:80", "-t", "/var/www/html"]

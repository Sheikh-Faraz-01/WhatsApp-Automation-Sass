$modules = @('auth', 'workspace', 'webhook', 'routing', 'chatbot', 'ai', 'knowledge-base', 'inbox', 'crm', 'messaging')
foreach ($m in $modules) {
  npx nest g mo $m --no-spec
  npx nest g co $m --no-spec
  npx nest g s $m --no-spec
  New-Item -ItemType Directory -Force -Path "src\$m\dto"
}

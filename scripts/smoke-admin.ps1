param(
  [string]$BaseUrl = 'http://127.0.0.1:5173',
  [string]$AdminEmail = $env:AURIA_ADMIN_EMAIL,
  [string]$AdminPassword = $env:AURIA_ADMIN_PASSWORD
)

$ErrorActionPreference = 'Stop'
$createdWorkId = $null
$createdPostId = $null
$uploadedMediaId = $null
$originalResume = $null
$originalSettings = $null
$duplicateConflict = $false
$mediaReferenceGuard = $false
$session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
$csrfToken = ''

function Invoke-Json {
  param([string]$Method, [string]$Path, $Body)
  $options = @{ Method = $Method; Uri = "$BaseUrl$Path" }
  $options.WebSession = $session
  if ($csrfToken -and $Method -in @('POST','PUT','PATCH','DELETE') -and $Path -ne '/api/auth/login') {
    $options.Headers = @{ 'x-csrf-token' = $csrfToken }
  }
  if ($null -ne $Body) {
    $options.ContentType = 'application/json; charset=utf-8'
    $options.Body = $Body | ConvertTo-Json -Depth 12 -Compress
  }
  Invoke-RestMethod @options
}

try {
  if (-not $AdminEmail -or -not $AdminPassword) { throw '请通过 -AdminEmail/-AdminPassword 或 AURIA_ADMIN_EMAIL/AURIA_ADMIN_PASSWORD 提供后台测试凭据。' }
  $login = Invoke-Json -Method Post -Path '/api/auth/login' -Body @{ email = $AdminEmail; password = $AdminPassword }
  $csrfToken = [string]$login.csrfToken
  if (-not $csrfToken) { throw '后台登录没有返回 CSRF token。' }
  $admin = Invoke-Json -Method Get -Path '/api/admin/bootstrap'
  $originalResume = $admin.resume
  $originalSettings = $admin.settings

  $work = Invoke-Json -Method Post -Path '/api/admin/works' -Body @{
    title = 'CRUD 回归测试作品'
    slug = 'crud-regression-work'
    kicker = '自动化测试'
    summary = '验证作品的创建、编辑、发布和删除。'
    problem = '测试问题'
    solution = '测试方案'
    result = '测试结果'
    stack = @('Smoke Test')
    cover_url = ''
    status = 'draft'
  }
  $createdWorkId = $work.id
  try {
    Invoke-Json -Method Post -Path '/api/admin/works' -Body @{ title = '重复别名测试'; slug = $work.slug } | Out-Null
  }
  catch {
    $duplicateConflict = [int]$_.Exception.Response.StatusCode -eq 409
  }
  if (-not $duplicateConflict) { throw '重复作品网址别名没有返回 HTTP 409。' }
  $public = Invoke-Json -Method Get -Path '/api/public/bootstrap'
  if ($public.works.slug -contains $work.slug) { throw '草稿作品错误地出现在公开页面。' }
  $work = Invoke-Json -Method Put -Path "/api/admin/works/$createdWorkId" -Body @{ title = 'CRUD 回归测试作品（已发布）'; status = 'published' }
  $public = Invoke-Json -Method Get -Path '/api/public/bootstrap'
  if ($public.works.slug -notcontains $work.slug) { throw '已发布作品没有出现在公开页面。' }

  $post = Invoke-Json -Method Post -Path '/api/admin/posts' -Body @{
    title = 'CRUD 回归测试文章'
    slug = 'crud-regression-post'
    category = '自动化测试'
    excerpt = '验证文章的创建、编辑、发布和删除。'
    body = '<h2>富文本标题</h2><p><strong>第一段。</strong></p><blockquote><p>第二段。</p></blockquote>'
    content_type = 'video'
    video_url = '/api/media/test-video.mp4'
    cover_url = '/api/media/test-cover.png'
    status = 'draft'
  }
  $createdPostId = $post.id
  if ($post.content_type -ne 'video' -or $post.video_url -ne '/api/media/test-video.mp4' -or $post.body -notlike '*<blockquote>*') { throw '富媒体文章字段没有完整保存。' }
  $public = Invoke-Json -Method Get -Path '/api/public/bootstrap'
  if ($public.posts.slug -contains $post.slug) { throw '草稿文章错误地出现在公开页面。' }
  $post = Invoke-Json -Method Put -Path "/api/admin/posts/$createdPostId" -Body @{ title = 'CRUD 回归测试文章（已发布）'; status = 'published' }
  $public = Invoke-Json -Method Get -Path '/api/public/bootstrap'
  if ($public.posts.slug -notcontains $post.slug) { throw '已发布文章没有出现在公开页面。' }

  $resumeProbe = $originalResume.PSObject.Copy()
  $resumeProbe.availability = "$($originalResume.availability) [回归测试]"
  Invoke-Json -Method Put -Path '/api/admin/resume' -Body $resumeProbe | Out-Null
  $public = Invoke-Json -Method Get -Path '/api/public/bootstrap'
  if ($public.resume.availability -ne $resumeProbe.availability) { throw '简历保存后没有同步到公开页面。' }

  $settingsProbe = $originalSettings.PSObject.Copy()
  $settingsProbe.role = "$($originalSettings.role) [回归测试]"
  Invoke-Json -Method Put -Path '/api/admin/settings' -Body $settingsProbe | Out-Null
  $public = Invoke-Json -Method Get -Path '/api/public/bootstrap'
  if ($public.settings.role -ne $settingsProbe.role) { throw '首页设置保存后没有同步到公开页面。' }

  $cookieHeader = ($session.Cookies.GetCookies($BaseUrl) | ForEach-Object { "$($_.Name)=$($_.Value)" }) -join '; '
  $uploadJson = & curl.exe --silent --show-error --fail -X POST -H "Cookie: $cookieHeader" -H "x-csrf-token: $csrfToken" -F "file=@public/og.png;type=image/png" "$BaseUrl/api/admin/upload"
  $upload = $uploadJson | ConvertFrom-Json
  $uploadedMediaId = $upload.id
  $mediaResponse = Invoke-WebRequest -Uri "$BaseUrl$($upload.url)" -Method Get
  if ($mediaResponse.StatusCode -ne 200 -or $mediaResponse.Headers.'Content-Type' -notlike 'image/png*') { throw '上传后的媒体文件无法正常读取。' }
  Invoke-Json -Method Put -Path "/api/admin/posts/$createdPostId" -Body @{ cover_url = $upload.url } | Out-Null
  try {
    Invoke-Json -Method Delete -Path "/api/admin/media/$uploadedMediaId" | Out-Null
  }
  catch {
    $mediaReferenceGuard = [int]$_.Exception.Response.StatusCode -eq 409
  }
  if (-not $mediaReferenceGuard) { throw '正在被文章引用的媒体文件没有阻止删除。' }

  [pscustomobject]@{
    workCrud = 'passed'
    richContentPostCrud = 'passed'
    resumeSave = 'passed'
    settingsSave = 'passed'
    mediaUploadReadDelete = 'passed'
    mediaReferenceGuard = 'passed'
    duplicateSlugConflict = 'passed'
  } | ConvertTo-Json -Compress
}
finally {
  if ($originalResume) { Invoke-Json -Method Put -Path '/api/admin/resume' -Body $originalResume | Out-Null }
  if ($originalSettings) { Invoke-Json -Method Put -Path '/api/admin/settings' -Body $originalSettings | Out-Null }
  if ($createdWorkId) { Invoke-Json -Method Delete -Path "/api/admin/works/$createdWorkId" | Out-Null }
  if ($createdPostId) { Invoke-Json -Method Delete -Path "/api/admin/posts/$createdPostId" | Out-Null }
  if ($uploadedMediaId) { Invoke-Json -Method Delete -Path "/api/admin/media/$uploadedMediaId" | Out-Null }
}


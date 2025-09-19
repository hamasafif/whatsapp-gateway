document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const user = document.getElementById('user').value;
  const pass = document.getElementById('pass').value;

  const res = await fetch('/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user, pass })
  });
  const data = await res.json();

  if (res.ok) {
    localStorage.setItem('token', data.token);
    window.location.replace('/');
  } else {
    alert('Login gagal: ' + data.error);
  }
});

function togglePwd() {
  const p = document.getElementById('pass');
  p.type = p.type === 'password' ? 'text' : 'password';
}
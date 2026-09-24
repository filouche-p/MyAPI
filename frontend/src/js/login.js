document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorMsg = document.getElementById('error-msg');
    errorMsg.textContent = '';

    try {
        const response = await fetch('/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            window.location.href = '/';
        } else {
            errorMsg.textContent = data.error || 'Erreur lors de la connexion';
        }
    } catch (error) {
        errorMsg.textContent = 'Erreur réseau';
    }
});

document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;
    const errorMsg = document.getElementById('error-msg');
    const successMsg = document.getElementById('success-msg');
    errorMsg.textContent = '';
    successMsg.textContent = '';

    try {
        const response = await fetch('/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            successMsg.textContent = 'Inscription réussie ! Redirection...';
            setTimeout(() => window.location.href = '/login.html', 1500);
        } else {
            errorMsg.textContent = data.error || 'Erreur lors de l\'inscription';
        }
    } catch (error) {
        errorMsg.textContent = 'Erreur réseau';
    }
});

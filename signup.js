const signupForm = document.getElementById("signupForm");
const password = document.getElementById("password");
const confirmPassword = document.getElementById("confirmPassword");
const strength = document.getElementById("strength");
const message = document.getElementById("message");

const errorModal = document.getElementById("errorModal");
const modalCard = document.getElementById("modalCard");
const modalTitle = document.getElementById("modalTitle");
const modalIconContainer = document.getElementById("modalIconContainer");
const modalIcon = document.getElementById("modalIcon");
const closeErrorBtn = document.getElementById("closeErrorBtn");


function showError(text){
    message.innerHTML = text;
    modalTitle.innerText = "Attention Needed";
    
    modalCard.className = "bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm text-center border-t-4 border-red-500";
    modalIconContainer.className = "w-12 h-12 bg-red-100 text-red-500 rounded-full flex items-center justify-center mx-auto mb-3";
    modalIcon.className = "fa-solid fa-triangle-exclamation text-xl";
    closeErrorBtn.className = "w-full bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-4 rounded-lg text-xs transition duration-150";

    errorModal.classList.remove("hidden");
    errorModal.classList.add("flex");
}

function showSuccess(text){
    message.innerHTML = text;
    modalTitle.innerText = "Success!";

   
    modalCard.className = "bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm text-center border-t-4 border-green-500";
    modalIconContainer.className = "w-12 h-12 bg-green-100 text-green-500 rounded-full flex items-center justify-center mx-auto mb-3";
    modalIcon.className = "fa-solid fa-[#10B981] fa-circle-check text-xl";
    closeErrorBtn.className = "w-full bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-4 rounded-lg text-xs transition duration-150";

    errorModal.classList.remove("hidden");
    errorModal.classList.add("flex");
}

function clearMessage(){
    message.innerHTML = "";
    errorModal.classList.add("hidden");
    errorModal.classList.remove("flex");
}

closeErrorBtn.addEventListener("click", clearMessage);

const showPassword = document.getElementById("showPassword");

showPassword.addEventListener("change", function(){
    if(this.checked){
        password.type = "text";
        confirmPassword.type = "text";
    }else{
        password.type = "password";
        confirmPassword.type = "password";
    }
});


password.addEventListener("input", function(){
    const value = password.value;

    if(value.length === 0){
        strength.innerHTML = "";
    }
    else if(value.length < 8){
        strength.innerHTML = "Weak Password";
        strength.style.color = "red";
    }
    else if(
        value.match(/[A-Z]/) &&
        value.match(/[a-z]/) &&
        value.match(/[0-9]/)
    ){
        strength.innerHTML = "Strong Password";
        strength.style.color = "green";
    }
    else{
        strength.innerHTML = "Medium Password";
        strength.style.color = "orange";
    }
});

signupForm.addEventListener("submit", async function(e){
    e.preventDefault();

    clearMessage();

    const fullname = document.getElementById("fullname").value.trim();
    const username = document.getElementById("username").value.trim();
    const email = document.getElementById("email").value.trim();
    const phoneInput = document.getElementById("phone");
    const phone = phoneInput ? phoneInput.value.trim() : "";
    const pass = password.value;
    const confirm = confirmPassword.value;
    const role = document.querySelector('input[name="role"]:checked');
    const terms = document.getElementById("terms").checked;

    if(fullname === "" || username === "" || email === ""){
        showError("Please fill in all required fields.");
        return;
    }

 
    const usernamePattern = /^[a-zA-Z]+[0-9]*$/;

    if(!usernamePattern.test(username)){
        showError("Username must start with letters and can only be followed by numbers at the end (e.g. john123).");
        return;
    }


    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if(!emailPattern.test(email)){
        showError("Please enter a valid email address.");
        return;
    }

    // Password Length
    if(pass.length < 8){
        showError("Password must be at least 8 characters.");
        return;
    }


    if(
        !pass.match(/[A-Z]/) ||
        !pass.match(/[a-z]/) ||
        !pass.match(/[0-9]/)
    ){
        showError("Password must contain at least 1 uppercase letter, 1 lowercase letter, and 1 number.");
        return;
    }

    if(pass !== confirm){
        showError("Passwords do not match.");
        return;
    }

    if(!role){
        showError("Please select your role.");
        return;
    }

    if(!terms){
        showError("Please agree to the Terms and Privacy Policy.");
        return;
    }

    const submitBtn = signupForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;

    try {
        const { data, error } = await supabaseClient.auth.signUp({
            email: email,
            password: pass,
            options: {
                emailRedirectTo: new URL("index.html", window.location.href).href,
                data: {
                    full_name: fullname,
                    username: username,
                    phone: phone,
                    role: role.value 
                }
            }
        });

        if(error){
            console.error("Signup error:", error);
            submitBtn.disabled = false;

            if(error.message && error.message.includes("Database error saving new user")){
                showError("That username may already be taken. Please choose another.");
            }
            else if(error.message && error.message.toLowerCase().includes("already registered")){
                showError("This email is already registered. Please sign in instead.");
            }
            else if(error.status === 429){
                showError("Too many attempts. Please wait a minute and try again.");
            }
            else{
                showError("Something went wrong. Please try again.");
            }
            return;
        }

        if(data.user && data.user.identities && data.user.identities.length === 0){
            submitBtn.disabled = false;
            showError("This email is already registered. Please sign in instead.");
            return;
        }

        if(data.session){
            await supabaseClient.auth.signOut();
            showSuccess("🎉 Account created successfully! Redirecting to login...");
            setTimeout(function(){
                window.location.href = "index.html";
            }, 2000);
        }
        else{
            showSuccess("🎉 Account created! Please check your email to confirm it, then sign in. Redirecting to login...");
            setTimeout(function(){
                window.location.href = "index.html";
            }, 4000);
        }
    }
    catch(err){
        console.error("Signup error:", err);
        submitBtn.disabled = false;
        showError("Something went wrong. Please try again.");
    }
});
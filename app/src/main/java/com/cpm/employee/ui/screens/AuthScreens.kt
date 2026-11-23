package com.cpm.employee.ui.screens

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.AccountBox
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import com.cpm.employee.R
import com.cpm.employee.ui.theme.BrandCyan
import com.cpm.employee.ui.theme.BrandNavy
import com.cpm.employee.ui.theme.Error
import com.cpm.employee.ui.theme.ScreenBackground
import com.cpm.employee.ui.theme.TextSecondary
import kotlinx.coroutines.delay

@Composable
fun SplashScreen(onFinished: () -> Unit) {
    var visible by remember { mutableStateOf(false) }
    LaunchedEffect(Unit) {
        visible = true
        delay(1300)
        onFinished()
    }
    Box(
        modifier = Modifier
            .fillMaxSize()
            .background(Color.White),
        contentAlignment = Alignment.Center
    ) {
        AnimatedVisibility(visible = visible, enter = fadeIn()) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                Image(
                    painter = painterResource(R.drawable.cpm_logo),
                    contentDescription = "CPM logo",
                    modifier = Modifier.size(148.dp)
                )
                Spacer(Modifier.height(18.dp))
                Text(
                    "CPM Employee",
                    style = MaterialTheme.typography.headlineSmall,
                    color = BrandNavy,
                    fontWeight = FontWeight.Bold
                )
                Spacer(Modifier.height(6.dp))
                Text("Move every customer forward", color = TextSecondary)
            }
        }
        CircularProgressIndicator(
            modifier = Modifier
                .align(Alignment.BottomCenter)
                .padding(bottom = 48.dp)
                .size(22.dp),
            color = BrandCyan,
            strokeWidth = 2.dp
        )
    }
}

object AuthScreens {
    @Composable
    fun LoginScreen(
        errorMessage: String?,
        isLoggingIn: Boolean,
        onCredentialsChanged: () -> Unit,
        onLogin: (String, String) -> Unit
    ) {
        var username by remember { mutableStateOf("") }
        var password by remember { mutableStateOf("") }

        Column(
            modifier = Modifier
                .fillMaxSize()
                .background(ScreenBackground)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 24.dp),
            verticalArrangement = Arrangement.Center
        ) {
            Column(
                modifier = Modifier.fillMaxWidth(),
                horizontalAlignment = Alignment.CenterHorizontally
            ) {
                Image(
                    painter = painterResource(R.drawable.cpm_logo),
                    contentDescription = "CPM logo",
                    modifier = Modifier.size(108.dp)
                )
                Spacer(Modifier.height(16.dp))
                Text(
                    "Welcome back",
                    style = MaterialTheme.typography.headlineMedium,
                    color = BrandNavy,
                    fontWeight = FontWeight.Bold
                )
                Spacer(Modifier.height(6.dp))
                Text(
                    "Sign in to your employee account",
                    color = TextSecondary,
                    style = MaterialTheme.typography.bodyMedium
                )
            }

            Spacer(Modifier.height(34.dp))
            OutlinedTextField(
                value = username,
                onValueChange = {
                    username = it
                    onCredentialsChanged()
                },
                modifier = Modifier.fillMaxWidth(),
                label = { Text("Employee username") },
                leadingIcon = { Icon(Icons.Default.AccountBox, contentDescription = null) },
                singleLine = true,
                shape = RoundedCornerShape(14.dp),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Text),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = BrandNavy,
                    focusedLabelColor = BrandNavy
                )
            )
            Spacer(Modifier.height(14.dp))
            OutlinedTextField(
                value = password,
                onValueChange = {
                    password = it
                    onCredentialsChanged()
                },
                modifier = Modifier.fillMaxWidth(),
                label = { Text("Password") },
                leadingIcon = { Icon(Icons.Default.Lock, contentDescription = null) },
                singleLine = true,
                shape = RoundedCornerShape(14.dp),
                visualTransformation = PasswordVisualTransformation(),
                keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password),
                colors = OutlinedTextFieldDefaults.colors(
                    focusedBorderColor = BrandNavy,
                    focusedLabelColor = BrandNavy
                )
            )
            if (errorMessage != null) {
                Text(
                    errorMessage,
                    modifier = Modifier.padding(top = 10.dp),
                    color = Error,
                    style = MaterialTheme.typography.bodySmall
                )
            }
            Spacer(Modifier.height(22.dp))
            Button(
                onClick = { onLogin(username, password) },
                enabled = !isLoggingIn,
                modifier = Modifier
                    .fillMaxWidth()
                    .height(54.dp),
                shape = RoundedCornerShape(14.dp),
                colors = ButtonDefaults.buttonColors(containerColor = BrandNavy)
            ) {
                if (isLoggingIn) {
                    CircularProgressIndicator(
                        modifier = Modifier.size(20.dp),
                        color = Color.White,
                        strokeWidth = 2.dp
                    )
                    Spacer(Modifier.width(10.dp))
                    Text("Signing in…", fontWeight = FontWeight.SemiBold)
                } else {
                    Text("Sign in", fontWeight = FontWeight.SemiBold)
                }
            }
            Spacer(Modifier.height(16.dp))
            Text(
                "Sign in with the employee account created for you by your CPM administrator.",
                modifier = Modifier.align(Alignment.CenterHorizontally),
                color = TextSecondary,
                style = MaterialTheme.typography.bodySmall,
                textAlign = androidx.compose.ui.text.style.TextAlign.Center
            )
            Spacer(Modifier.height(36.dp))
            RowSpacerBrand()
        }
    }
}

@Composable
private fun RowSpacerBrand() {
    androidx.compose.foundation.layout.Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.Center,
        verticalAlignment = Alignment.CenterVertically
    ) {
        Box(
            Modifier
                .width(22.dp)
                .height(3.dp)
                .background(BrandCyan, RoundedCornerShape(2.dp))
        )
        Spacer(Modifier.width(6.dp))
        Text("PACKERS  ·  MOVERS", color = BrandNavy, style = MaterialTheme.typography.labelSmall)
    }
}

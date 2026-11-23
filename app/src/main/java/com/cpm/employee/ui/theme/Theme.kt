package com.cpm.employee.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

val BrandNavy = Color(0xFF1E2470)
val BrandCyan = Color(0xFF02A8F2)
val ScreenBackground = Color(0xFFF5F7FC)
val CardBackground = Color(0xFFFFFFFF)
val TextPrimary = Color(0xFF20243A)
val TextSecondary = Color(0xFF777E91)
val Border = Color(0xFFE7EAF1)
val Success = Color(0xFF26845B)
val Warning = Color(0xFFB9741C)
val Error = Color(0xFFB74444)
val PaleBlue = Color(0xFFEAF7FE)

private val EmployeeColors = lightColorScheme(
    primary = BrandNavy,
    onPrimary = Color.White,
    secondary = BrandCyan,
    onSecondary = Color.White,
    background = ScreenBackground,
    onBackground = TextPrimary,
    surface = CardBackground,
    onSurface = TextPrimary,
    surfaceVariant = Color(0xFFF0F2F8),
    onSurfaceVariant = TextSecondary,
    outline = Border,
    error = Error
)

@Composable
fun CPMEmployeeTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = EmployeeColors,
        content = content
    )
}

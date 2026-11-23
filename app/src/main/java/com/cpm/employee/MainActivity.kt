package com.cpm.employee

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.lifecycle.viewmodel.compose.viewModel
import com.cpm.employee.navigation.EmployeeNavGraph
import com.cpm.employee.ui.theme.CPMEmployeeTheme
import com.cpm.employee.ui.theme.ScreenBackground

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            CPMEmployeeTheme {
                EmployeeApp()
            }
        }
    }
}

@Composable
private fun EmployeeApp() {
    val employeeViewModel: EmployeeViewModel = viewModel()
    Surface(color = ScreenBackground) {
        EmployeeNavGraph(viewModel = employeeViewModel)
    }
}

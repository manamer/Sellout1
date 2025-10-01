package com.manamer.backend.business.sellout;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.client.discovery.EnableDiscoveryClient;

@SpringBootApplication
@EnableDiscoveryClient
public class SelloutApplication {

	public static void main(String[] args) {
		SpringApplication.run(SelloutApplication.class, args);
	}
}

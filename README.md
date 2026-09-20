# Gainesville-Mosquito-Risk-Heat-Map

Our algorithm estimates relative mosquito density using rainfall and from the past week, proximity to water, temperature suitability, and recent larvae observations. It also considers repeated wet days, water-feature type, and report age. 

We calculate scores across a geographic grid and smoothly interpolate between them to create a continuous green-to-red surface. Unlike overlapping heat map dots, this approach avoids artificially increasing intensity when zooming out.

The prototype still needs browser troubleshooting and calibration against local mosquito counts before its estimates can be validated.

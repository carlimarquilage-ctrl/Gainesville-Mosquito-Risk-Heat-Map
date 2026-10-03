🦟 Gainesville Mosquito Risk Heat Map

An interactive mosquito-risk visualization for Gainesville, Florida that combines environmental conditions and geographic data to estimate areas with higher relative mosquito activity.

Overview

The Gainesville Mosquito Risk Heat Map was built to explore how environmental factors can be combined to estimate mosquito risk across Gainesville.

Rather than displaying individual reports as overlapping heat-map points, the project calculates a risk score across a geographic grid and interpolates between those locations to create a continuous risk surface.

Areas are visualized from green (lower estimated risk) to red (higher estimated risk).

How It Works

The risk model considers several factors associated with mosquito activity:

🌧️ Recent rainfall

🌊 Proximity to water

🌡️ Temperature suitability

🐛 Recent larvae observations

💧 Consecutive wet days

🏞️ Type of nearby water feature

⏱️ Age of mosquito/larvae reports

These factors are combined into a relative risk score for locations across Gainesville.

The scores are then calculated across a geographic grid and smoothly interpolated to create the final heat map.

Why Use a Geographic Grid?

Traditional heat maps often place circles around individual observations. When many circles overlap—or when the map is zoomed out—the visualization can make certain areas appear more intense simply because the points overlap.

This project instead:

Calculates risk at geographic grid points.

Combines environmental and observation data into a risk score.

Interpolates between those points.

Displays the resulting values as a continuous risk surface.

This produces a more consistent visualization across different zoom levels.

Features

Interactive Gainesville map

Environmental mosquito-risk scoring

Geographic grid-based calculations

Continuous risk-surface visualization

Rainfall and temperature factors

Water proximity analysis

Mosquito larvae observations

Dynamic risk calculations

Tech Stack

HTML

CSS

JavaScript

Geographic mapping and visualization

Environmental and location-based data

Risk Model

At a high level, the model can be represented as:

Mosquito Risk =
    Rainfall Factor
  + Water Proximity Factor
  + Temperature Factor
  + Larvae Observation Factor
  + Additional Environmental Adjustments

The result represents relative mosquito risk, not a confirmed mosquito population measurement.

Project Goal

The goal of the project is to demonstrate how software, environmental data, and geographic visualization can be combined to make local information easier to understand.

A system like this could eventually help communities identify areas where mosquito monitoring or prevention efforts may deserve additional attention.

Current Limitations

This project is currently a prototype.

The risk estimates have not yet been validated against official local mosquito population counts, so the map should not be interpreted as a real-time public-health warning system.

Additional browser testing, model calibration, and validation against real mosquito observations would improve the system.

Future Improvements

Potential next steps include:

Validate predictions against local mosquito-count data

Improve weighting of environmental variables

Add additional live environmental data sources

Incorporate historical mosquito observations

Improve mobile responsiveness

Add historical risk trends

Evaluate the accuracy of predicted high-risk areas

What I Learned

Building this project provided experience with:

Turning real-world environmental factors into a computational model

Working with geographic data

Building interactive data visualizations

Designing algorithms around multiple input variables

Connecting environmental data with software applications

Thinking critically about model limitations and validation

Disclaimer

This project is an experimental prototype created for educational and software-development purposes. Risk values represent model estimates and should not be interpreted as verified mosquito-density measurements or official public-health guidance.
